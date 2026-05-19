import { z } from 'zod'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db, schema } from '@/app/_lib/db'
import { requireUser } from '@/app/_lib/auth/session'
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
    const side = url.searchParams.get('side') as 'left' | 'right' | null
    const sort = url.searchParams.get('sort') ?? 'score'

    const conditions = [eq(schema.comments.issueId, id), isNull(schema.comments.deletedAt)]
    if (side === 'left' || side === 'right') conditions.push(eq(schema.comments.side, side))

    const empathySql = sql<number>`(
      SELECT COUNT(*)::int FROM ${schema.reactions} r
      WHERE r.comment_id = ${schema.comments.id} AND r.kind = 'empathy'
    )`
    const dopamineSql = sql<number>`(
      SELECT COUNT(*)::int FROM ${schema.reactions} r
      WHERE r.comment_id = ${schema.comments.id} AND r.kind = 'dopamine'
    )`
    const rebuttalSql = sql<number>`(
      SELECT COUNT(DISTINCT rp.user_id)::int FROM ${schema.replies} rp
      WHERE rp.comment_id = ${schema.comments.id}
        AND rp.parent_reply_id IS NULL
        AND rp.deleted_at IS NULL
    )`

    const rows = await db
      .select({
        id: schema.comments.id,
        userId: schema.comments.userId,
        nickname: schema.users.nickname,
        side: schema.comments.side,
        body: schema.comments.body,
        createdAt: schema.comments.createdAt,
        updatedAt: schema.comments.updatedAt,
        empathy: empathySql,
        dopamine: dopamineSql,
        rebuttal: rebuttalSql,
      })
      .from(schema.comments)
      .innerJoin(schema.users, eq(schema.users.id, schema.comments.userId))
      .where(and(...conditions))
      .orderBy(sort === 'recent' ? desc(schema.comments.createdAt) : desc(schema.comments.createdAt))

    const withScore = rows
      .map((r) => ({
        ...r,
        empathy: Number(r.empathy),
        dopamine: Number(r.dopamine),
        rebuttal: Number(r.rebuttal),
        score: commentScore({
          empathy: Number(r.empathy),
          dopamine: Number(r.dopamine),
          rebuttal: Number(r.rebuttal),
        }),
      }))
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
    const user = await requireUser()
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
