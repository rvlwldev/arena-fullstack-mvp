import { z } from 'zod'
import { and, asc, desc, eq, isNull, lt } from 'drizzle-orm'
import { db, schema } from '@/app/_lib/db'
import { activeBansByUserIds, requireActiveUser } from '@/app/_lib/auth/session'
import { handle, fail, created, ok } from '@/app/_lib/http'
import { deriveIssueStatus } from '@/app/_lib/domain/issue-status'
import { broadcast } from '@/app/_lib/sse-hub'

const postSchema = z.object({ body: z.string().min(1).max(500) })

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params
    const url = new URL(req.url)
    const cursor = url.searchParams.get('cursor')
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 100)

    const where = [eq(schema.chats.issueId, id), isNull(schema.chats.deletedAt)]
    if (cursor) where.push(lt(schema.chats.id, Number(cursor)))

    const rows = await db
      .select({
        id: schema.chats.id,
        userId: schema.chats.userId,
        nickname: schema.users.nickname,
        body: schema.chats.body,
        createdAt: schema.chats.createdAt,
      })
      .from(schema.chats)
      .innerJoin(schema.users, eq(schema.users.id, schema.chats.userId))
      .where(and(...where))
      .orderBy(desc(schema.chats.id))
      .limit(limit)

    const bans = await activeBansByUserIds(rows.map((r) => r.userId))
    const enriched = rows.map((r) => {
      const b = bans.get(r.userId)
      return {
        ...r,
        ban: b ? { expiresAt: b.expiresAt, memo: b.memo } : null,
      }
    })

    return ok({ chats: enriched.slice().reverse(), nextCursor: rows.at(-1)?.id ?? null })
  })
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireActiveUser()
    const { id } = await ctx.params
    const body = postSchema.parse(await req.json())

    const [issue] = await db.select().from(schema.issues).where(eq(schema.issues.id, id)).limit(1)
    if (!issue) return fail(404, '이슈를 찾을 수 없습니다.')
    const status = deriveIssueStatus(new Date(), {
      opensAt: issue.opensAt,
      closesAt: issue.closesAt,
      resultAt: issue.resultAt,
    })
    // V2.G: RESULT 상태에서도 채팅은 허용 (의견·반응만 잠금)
    if (status !== 'ACTIVE' && status !== 'RESULT') {
      return fail(409, '채팅 가능한 시간이 아닙니다.')
    }

    const [row] = await db
      .insert(schema.chats)
      .values({ issueId: id, userId: user.id, body: body.body })
      .returning()

    await broadcast(id, 'chat', {
      id: row.id,
      userId: row.userId,
      nickname: user.nickname,
      body: row.body,
      createdAt: row.createdAt,
    })

    return created({ chat: row })
  })
}
