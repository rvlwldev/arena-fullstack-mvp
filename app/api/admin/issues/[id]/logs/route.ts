import { and, asc, desc, eq } from 'drizzle-orm'
import { db, schema } from '@/app/_lib/db'
import { activeBansByUserIds, requireAdmin } from '@/app/_lib/auth/session'
import { handle, fail, ok } from '@/app/_lib/http'

/**
 * 관리자 전용 이슈 로그: 채팅 + 의견 + 답글 (deleted 포함)
 * GET /api/admin/issues/[id]/logs?type=chats|comments
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireAdmin()
    const { id } = await ctx.params
    const url = new URL(req.url)
    const type = url.searchParams.get('type') ?? 'chats'

    const [issue] = await db.select().from(schema.issues).where(eq(schema.issues.id, id)).limit(1)
    if (!issue) return fail(404, '이슈를 찾을 수 없습니다.')

    if (type === 'chats') {
      const rows = await db
        .select({
          id: schema.chats.id,
          userId: schema.chats.userId,
          nickname: schema.users.nickname,
          email: schema.users.email,
          body: schema.chats.body,
          createdAt: schema.chats.createdAt,
          deletedAt: schema.chats.deletedAt,
        })
        .from(schema.chats)
        .innerJoin(schema.users, eq(schema.users.id, schema.chats.userId))
        .where(eq(schema.chats.issueId, id))
        .orderBy(desc(schema.chats.id))
        .limit(500)
      const bans = await activeBansByUserIds(rows.map((r) => r.userId))
      return ok({
        chats: rows.map((r) => ({
          ...r,
          ban: bans.get(r.userId)
            ? { expiresAt: bans.get(r.userId)!.expiresAt, memo: bans.get(r.userId)!.memo }
            : null,
        })),
      })
    }

    if (type === 'comments') {
      const comments = await db
        .select({
          id: schema.comments.id,
          userId: schema.comments.userId,
          nickname: schema.users.nickname,
          email: schema.users.email,
          side: schema.comments.side,
          body: schema.comments.body,
          createdAt: schema.comments.createdAt,
          updatedAt: schema.comments.updatedAt,
          deletedAt: schema.comments.deletedAt,
        })
        .from(schema.comments)
        .innerJoin(schema.users, eq(schema.users.id, schema.comments.userId))
        .where(eq(schema.comments.issueId, id))
        .orderBy(desc(schema.comments.createdAt))

      const allReplies = await db
        .select({
          id: schema.replies.id,
          commentId: schema.replies.commentId,
          parentReplyId: schema.replies.parentReplyId,
          userId: schema.replies.userId,
          nickname: schema.users.nickname,
          email: schema.users.email,
          side: schema.replies.side,
          body: schema.replies.body,
          createdAt: schema.replies.createdAt,
          deletedAt: schema.replies.deletedAt,
        })
        .from(schema.replies)
        .innerJoin(schema.users, eq(schema.users.id, schema.replies.userId))
        .innerJoin(schema.comments, eq(schema.comments.id, schema.replies.commentId))
        .where(eq(schema.comments.issueId, id))
        .orderBy(asc(schema.replies.createdAt))

      const userIds = Array.from(
        new Set([...comments.map((c) => c.userId), ...allReplies.map((r) => r.userId)]),
      )
      const bans = await activeBansByUserIds(userIds)
      const withBan = <T extends { userId: string }>(rs: T[]) =>
        rs.map((r) => ({
          ...r,
          ban: bans.get(r.userId)
            ? { expiresAt: bans.get(r.userId)!.expiresAt, memo: bans.get(r.userId)!.memo }
            : null,
        }))

      return ok({ comments: withBan(comments), replies: withBan(allReplies) })
    }

    return fail(400, 'type은 chats 또는 comments')
  })
}
