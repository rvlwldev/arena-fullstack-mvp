import { z } from 'zod'
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'
import { db, schema } from '@/app/_lib/db'
import { requireUser } from '@/app/_lib/auth/session'
import { handle, fail, created, ok } from '@/app/_lib/http'
import { deriveIssueStatus } from '@/app/_lib/domain/issue-status'
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

    const likesSql = sql<number>`COALESCE(SUM(CASE WHEN ${schema.votes.value} = 1 THEN 1 ELSE 0 END), 0)::int`
    const dislikesSql = sql<number>`COALESCE(SUM(CASE WHEN ${schema.votes.value} = -1 THEN 1 ELSE 0 END), 0)::int`

    const rows = await db
      .select({
        id: schema.comments.id,
        userId: schema.comments.userId,
        nickname: schema.users.nickname,
        side: schema.comments.side,
        body: schema.comments.body,
        createdAt: schema.comments.createdAt,
        updatedAt: schema.comments.updatedAt,
        likes: likesSql,
        dislikes: dislikesSql,
        score: sql<number>`(${likesSql}) - (${dislikesSql})`,
      })
      .from(schema.comments)
      .innerJoin(schema.users, eq(schema.users.id, schema.comments.userId))
      .leftJoin(schema.votes, eq(schema.votes.commentId, schema.comments.id))
      .where(and(...conditions))
      .groupBy(schema.comments.id, schema.users.nickname)
      .orderBy(
        sort === 'recent'
          ? desc(schema.comments.createdAt)
          : sql`(${likesSql}) - (${dislikesSql}) DESC, ${schema.comments.createdAt} ASC`,
      )

    return ok({ comments: rows })
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

      await broadcast(id, 'comment', {
        type: 'created',
        comment: {
          id: row.id,
          userId: row.userId,
          nickname: user.nickname,
          side: row.side,
          body: row.body,
          createdAt: row.createdAt,
          score: 0,
          likes: 0,
          dislikes: 0,
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
