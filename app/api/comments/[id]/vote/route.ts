import { z } from 'zod'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { db, schema } from '@/app/_lib/db'
import { requireUser } from '@/app/_lib/auth/session'
import { handle, fail, noContent, ok } from '@/app/_lib/http'
import { decideVoteOperation, type VoteValue } from '@/app/_lib/domain/vote'
import { deriveIssueStatus } from '@/app/_lib/domain/issue-status'
import { broadcast } from '@/app/_lib/sse-hub'

const putSchema = z.object({ value: z.union([z.literal(1), z.literal(-1)]) })

async function loadCommentWithIssue(commentId: string) {
  const [row] = await db
    .select({ comment: schema.comments, issue: schema.issues })
    .from(schema.comments)
    .innerJoin(schema.issues, eq(schema.issues.id, schema.comments.issueId))
    .where(and(eq(schema.comments.id, commentId), isNull(schema.comments.deletedAt)))
    .limit(1)
  return row
}

async function broadcastScore(commentId: string, issueId: string) {
  const [agg] = await db
    .select({
      likes: sql<number>`COUNT(*) FILTER (WHERE ${schema.votes.value} = 1)`,
      dislikes: sql<number>`COUNT(*) FILTER (WHERE ${schema.votes.value} = -1)`,
    })
    .from(schema.votes)
    .where(eq(schema.votes.commentId, commentId))
  const likes = Number(agg?.likes ?? 0)
  const dislikes = Number(agg?.dislikes ?? 0)
  await broadcast(issueId, 'vote', { commentId, likes, dislikes, score: likes - dislikes })
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser()
    const { id: commentId } = await ctx.params
    const body = putSchema.parse(await req.json())

    const found = await loadCommentWithIssue(commentId)
    if (!found) return fail(404, '의견을 찾을 수 없습니다.')
    if (found.comment.userId === user.id) return fail(403, '자기 의견에는 투표할 수 없습니다.')

    const status = deriveIssueStatus(new Date(), {
      opensAt: found.issue.opensAt,
      closesAt: found.issue.closesAt,
      resultAt: found.issue.resultAt,
    })
    if (status !== 'ACTIVE') return fail(409, '투표 가능한 시간이 아닙니다.')

    const [existing] = await db
      .select()
      .from(schema.votes)
      .where(and(eq(schema.votes.commentId, commentId), eq(schema.votes.userId, user.id)))
      .limit(1)

    const decision = decideVoteOperation({
      existing: (existing?.value as VoteValue | undefined) ?? null,
      requested: body.value,
    })

    if (decision.kind === 'INSERT') {
      await db.insert(schema.votes).values({ commentId, userId: user.id, value: decision.value })
    } else if (decision.kind === 'UPDATE') {
      await db
        .update(schema.votes)
        .set({ value: decision.value, updatedAt: new Date() })
        .where(and(eq(schema.votes.commentId, commentId), eq(schema.votes.userId, user.id)))
    }

    await broadcastScore(commentId, found.issue.id)
    return ok({ operation: decision.kind, value: 'value' in decision ? decision.value : null })
  })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser()
    const { id: commentId } = await ctx.params
    const found = await loadCommentWithIssue(commentId)
    if (!found) return fail(404, '의견을 찾을 수 없습니다.')

    const status = deriveIssueStatus(new Date(), {
      opensAt: found.issue.opensAt,
      closesAt: found.issue.closesAt,
      resultAt: found.issue.resultAt,
    })
    if (status !== 'ACTIVE') return fail(409, '투표 가능한 시간이 아닙니다.')

    await db
      .delete(schema.votes)
      .where(and(eq(schema.votes.commentId, commentId), eq(schema.votes.userId, user.id)))
    await broadcastScore(commentId, found.issue.id)
    return noContent()
  })
}
