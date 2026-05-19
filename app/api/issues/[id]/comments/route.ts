import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { db, schema } from '@/app/_lib/db'
import { requireActiveUser } from '@/app/_lib/auth/session'
import { handle, fail, created, ok } from '@/app/_lib/http'
import { deriveIssueStatus } from '@/app/_lib/domain/issue-status'
import { commentScore } from '@/app/_lib/domain/score'
import { broadcast } from '@/app/_lib/sse-hub'

const createSchema = z.object({
  side: z.enum(['left', 'right']),
  body: z.string().min(1).max(2000),
})

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params
    const url = new URL(req.url)
    const side = url.searchParams.get('side')
    const sort = url.searchParams.get('sort') ?? 'score'

    const sideFilter = side === 'left' || side === 'right' ? side : null

    // 1쿼리로 의견 + 집계: reactions/replies LEFT JOIN + GROUP BY
    // (의견당 3 correlated subquery → 단일 패스)
    const result = await db.execute(sql`
      SELECT
        c.id, c.user_id, u.nickname, c.side, c.body, c.created_at, c.updated_at,
        COALESCE(rx.empathy, 0)  AS empathy,
        COALESCE(rx.dopamine, 0) AS dopamine,
        COALESCE(rb.rebuttal, 0) AS rebuttal
      FROM comments c
      JOIN users u ON u.id = c.user_id
      LEFT JOIN (
        SELECT comment_id,
               COUNT(*) FILTER (WHERE kind = 'empathy')::int  AS empathy,
               COUNT(*) FILTER (WHERE kind = 'dopamine')::int AS dopamine
        FROM reactions WHERE comment_id IS NOT NULL
        GROUP BY comment_id
      ) rx ON rx.comment_id = c.id
      LEFT JOIN (
        SELECT comment_id, COUNT(DISTINCT user_id)::int AS rebuttal
        FROM replies
        WHERE parent_reply_id IS NULL AND deleted_at IS NULL
        GROUP BY comment_id
      ) rb ON rb.comment_id = c.id
      WHERE c.issue_id = ${id} AND c.deleted_at IS NULL
        ${sideFilter ? sql`AND c.side = ${sideFilter}` : sql``}
    `)

    const withScore = result.rows
      .map((r) => {
        const row = r as {
          id: string; user_id: string; nickname: string; side: 'left' | 'right'; body: string
          created_at: string | Date; updated_at: string | Date
          empathy: number; dopamine: number; rebuttal: number
        }
        const empathy = Number(row.empathy)
        const dopamine = Number(row.dopamine)
        const rebuttal = Number(row.rebuttal)
        return {
          id: row.id,
          userId: row.user_id,
          nickname: row.nickname,
          side: row.side,
          body: row.body,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
          empathy, dopamine, rebuttal,
          score: commentScore({ empathy, dopamine, rebuttal }),
        }
      })
      .sort((a, b) =>
        sort === 'recent'
          ? b.createdAt.getTime() - a.createdAt.getTime()
          : b.score - a.score || a.createdAt.getTime() - b.createdAt.getTime(),
      )

    return ok({ comments: withScore })
  })
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireActiveUser()
    const { id } = await ctx.params
    const body = createSchema.parse(await req.json())

    const [issue] = await db.select().from(schema.issues).where(eq(schema.issues.id, id)).limit(1)
    if (!issue) return fail(404, '이슈를 찾을 수 없습니다.')
    const status = deriveIssueStatus(new Date(), {
      opensAt: issue.opensAt,
      closesAt: issue.closesAt,
      resultAt: issue.resultAt,
    })
    if (status !== 'ACTIVE') return fail(409, '의견 등록이 가능한 시간이 아닙니다.')

    try {
      const [row] = await db
        .insert(schema.comments)
        .values({ issueId: id, userId: user.id, side: body.side, body: body.body })
        .returning()

      broadcast(id, 'comment', {
        type: 'created',
        comment: {
          id: row.id,
          userId: row.userId,
          nickname: user.nickname,
          side: row.side,
          body: row.body,
          createdAt: row.createdAt,
          empathy: 0,
          dopamine: 0,
          rebuttal: 0,
          score: 0,
        },
      })

      return created({ comment: row })
    } catch (e) {
      if (isUniqueViolation(e)) return fail(409, '이 이슈에는 이미 의견을 등록했습니다.')
      throw e
    }
  })
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '23505'
}
