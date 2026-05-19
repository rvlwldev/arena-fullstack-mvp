import { z } from 'zod'
import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { db, schema } from '@/app/_lib/db'
import { requireActiveUser } from '@/app/_lib/auth/session'
import { handle, fail, created, ok } from '@/app/_lib/http'
import { deriveIssueStatus } from '@/app/_lib/domain/issue-status'
import { canReply } from '@/app/_lib/domain/reaction'
import { resolveArenaRole } from '@/app/_lib/auth/arena-role'
import { broadcast } from '@/app/_lib/sse-hub'

const postSchema = z.object({
  body: z.string().min(1).max(1000),
  parentReplyId: z.string().uuid().optional(),
  hintRole: z.enum(['left', 'right', 'spectator']).optional(),
})

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id: commentId } = await ctx.params
    const empathySql = sql<number>`(SELECT COUNT(*)::int FROM ${schema.reactions} rr WHERE rr.reply_id = ${schema.replies.id} AND rr.kind = 'empathy')`
    const dopamineSql = sql<number>`(SELECT COUNT(*)::int FROM ${schema.reactions} rr WHERE rr.reply_id = ${schema.replies.id} AND rr.kind = 'dopamine')`
    const rows = await db
      .select({
        id: schema.replies.id,
        commentId: schema.replies.commentId,
        parentReplyId: schema.replies.parentReplyId,
        userId: schema.replies.userId,
        nickname: schema.users.nickname,
        side: schema.replies.side,
        body: schema.replies.body,
        createdAt: schema.replies.createdAt,
        empathy: empathySql,
        dopamine: dopamineSql,
      })
      .from(schema.replies)
      .innerJoin(schema.users, eq(schema.users.id, schema.replies.userId))
      .where(and(eq(schema.replies.commentId, commentId), isNull(schema.replies.deletedAt)))
      .orderBy(asc(schema.replies.createdAt))

    return ok({
      replies: rows.map((r) => ({
        ...r,
        empathy: Number(r.empathy),
        dopamine: Number(r.dopamine),
      })),
    })
  })
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireActiveUser()
    const { id: commentId } = await ctx.params
    const body = postSchema.parse(await req.json())

    const [pair] = await db
      .select({ comment: schema.comments, issue: schema.issues })
      .from(schema.comments)
      .innerJoin(schema.issues, eq(schema.issues.id, schema.comments.issueId))
      .where(and(eq(schema.comments.id, commentId), isNull(schema.comments.deletedAt)))
      .limit(1)
    if (!pair) return fail(404, '의견을 찾을 수 없습니다.')

    const status = deriveIssueStatus(new Date(), {
      opensAt: pair.issue.opensAt,
      closesAt: pair.issue.closesAt,
      resultAt: pair.issue.resultAt,
    })
    if (status !== 'ACTIVE') return fail(409, '답글 작성 가능한 시간이 아닙니다.')

    const role = await resolveArenaRole(user.id, pair.issue.id, body.hintRole ?? null)
    if (!canReply(role)) return fail(403, '눈팅충은 답글을 달 수 없습니다.')
    if (role !== 'left' && role !== 'right') return fail(403, '진영을 먼저 선택하세요.')

    // 부모 답글 검증 (있으면 같은 의견 트리여야 함)
    if (body.parentReplyId) {
      const [parent] = await db
        .select({ id: schema.replies.id, commentId: schema.replies.commentId })
        .from(schema.replies)
        .where(eq(schema.replies.id, body.parentReplyId))
        .limit(1)
      if (!parent || parent.commentId !== commentId) {
        return fail(400, '부모 답글이 잘못되었습니다.')
      }
    }

    const [row] = await db
      .insert(schema.replies)
      .values({
        commentId,
        parentReplyId: body.parentReplyId ?? null,
        userId: user.id,
        side: role,
        body: body.body,
      })
      .returning()

    broadcast(pair.issue.id, 'reply', {
      type: 'created',
      reply: {
        id: row.id,
        commentId: row.commentId,
        parentReplyId: row.parentReplyId,
        userId: row.userId,
        nickname: user.nickname,
        side: row.side,
        body: row.body,
        createdAt: row.createdAt,
        empathy: 0,
        dopamine: 0,
      },
    })

    return created({ reply: row })
  })
}
