import { z } from 'zod'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { db, schema } from '@/app/_lib/db'
import { requireUser } from '@/app/_lib/auth/session'
import { handle, fail, ok, noContent } from '@/app/_lib/http'
import { deriveIssueStatus } from '@/app/_lib/domain/issue-status'
import { canReact } from '@/app/_lib/domain/reaction'
import { resolveArenaRole } from '@/app/_lib/auth/arena-role'
import { commentScore } from '@/app/_lib/domain/score'
import { broadcast } from '@/app/_lib/sse-hub'

const postSchema = z.object({
  kind: z.enum(['empathy', 'dopamine']),
  hintRole: z.enum(['left', 'right', 'spectator']).optional(),
})

async function loadCommentWithIssue(commentId: string) {
  const [row] = await db
    .select({ comment: schema.comments, issue: schema.issues })
    .from(schema.comments)
    .innerJoin(schema.issues, eq(schema.issues.id, schema.comments.issueId))
    .where(and(eq(schema.comments.id, commentId), isNull(schema.comments.deletedAt)))
    .limit(1)
  return row
}

async function broadcastCommentScore(commentId: string, issueId: string) {
  const result = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM reactions WHERE comment_id = ${commentId} AND kind = 'empathy') AS empathy,
      (SELECT COUNT(*)::int FROM reactions WHERE comment_id = ${commentId} AND kind = 'dopamine') AS dopamine,
      (SELECT COUNT(DISTINCT user_id)::int FROM replies WHERE comment_id = ${commentId} AND parent_reply_id IS NULL AND deleted_at IS NULL) AS rebuttal
  `)
  const agg = result.rows[0] as { empathy: number; dopamine: number; rebuttal: number } | undefined
  const e = Number(agg?.empathy ?? 0)
  const d = Number(agg?.dopamine ?? 0)
  const r = Number(agg?.rebuttal ?? 0)
  broadcast(issueId, 'reaction', {
    targetType: 'comment',
    targetId: commentId,
    empathy: e,
    dopamine: d,
    rebuttal: r,
    score: commentScore({ empathy: e, dopamine: d, rebuttal: r }),
  })
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser()
    const { id: commentId } = await ctx.params
    const body = postSchema.parse(await req.json())

    const found = await loadCommentWithIssue(commentId)
    if (!found) return fail(404, '의견을 찾을 수 없습니다.')
    if (found.comment.userId === user.id) return fail(403, '본인 의견에는 반응할 수 없습니다.')

    const status = deriveIssueStatus(new Date(), {
      opensAt: found.issue.opensAt,
      closesAt: found.issue.closesAt,
      resultAt: found.issue.resultAt,
    })
    if (status !== 'ACTIVE') return fail(409, '반응 가능한 시간이 아닙니다.')

    const role = await resolveArenaRole(user.id, found.issue.id, body.hintRole ?? null)
    if (!canReact(role, body.kind)) {
      return fail(403, '눈팅충은 공감만 가능합니다.')
    }

    // 토글: 이미 같은 반응이 있으면 삭제, 없으면 삽입
    const [existing] = await db
      .select({ id: schema.reactions.id })
      .from(schema.reactions)
      .where(
        and(
          eq(schema.reactions.commentId, commentId),
          eq(schema.reactions.userId, user.id),
          eq(schema.reactions.kind, body.kind),
        ),
      )
      .limit(1)

    let operation: 'INSERT' | 'DELETE'
    if (existing) {
      await db.delete(schema.reactions).where(eq(schema.reactions.id, existing.id))
      operation = 'DELETE'
    } else {
      await db.insert(schema.reactions).values({
        userId: user.id,
        commentId,
        kind: body.kind,
      })
      operation = 'INSERT'
    }

    await broadcastCommentScore(commentId, found.issue.id)
    return ok({ operation, kind: body.kind })
  })
}
