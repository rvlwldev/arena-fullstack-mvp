import { z } from 'zod'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { db, schema } from '@/app/_lib/db'
import { requireUser } from '@/app/_lib/auth/session'
import { handle, fail, ok } from '@/app/_lib/http'
import { deriveIssueStatus } from '@/app/_lib/domain/issue-status'
import { canReact } from '@/app/_lib/domain/reaction'
import { resolveArenaRole } from '@/app/_lib/auth/arena-role'
import { broadcast } from '@/app/_lib/sse-hub'

const postSchema = z.object({
  kind: z.enum(['empathy', 'dopamine']),
  hintRole: z.enum(['left', 'right', 'spectator']).optional(),
})

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser()
    const { id: replyId } = await ctx.params
    const body = postSchema.parse(await req.json())

    const [pair] = await db
      .select({ reply: schema.replies, comment: schema.comments, issue: schema.issues })
      .from(schema.replies)
      .innerJoin(schema.comments, eq(schema.comments.id, schema.replies.commentId))
      .innerJoin(schema.issues, eq(schema.issues.id, schema.comments.issueId))
      .where(and(eq(schema.replies.id, replyId), isNull(schema.replies.deletedAt)))
      .limit(1)
    if (!pair) return fail(404, '답글을 찾을 수 없습니다.')
    if (pair.reply.userId === user.id) return fail(403, '본인 답글에는 반응할 수 없습니다.')

    const status = deriveIssueStatus(new Date(), {
      opensAt: pair.issue.opensAt,
      closesAt: pair.issue.closesAt,
      resultAt: pair.issue.resultAt,
    })
    if (status !== 'ACTIVE') return fail(409, '반응 가능한 시간이 아닙니다.')

    const role = await resolveArenaRole(user.id, pair.issue.id, body.hintRole ?? null)
    if (!canReact(role, body.kind)) return fail(403, '눈팅충은 공감만 가능합니다.')

    const [existing] = await db
      .select({ id: schema.reactions.id })
      .from(schema.reactions)
      .where(
        and(
          eq(schema.reactions.replyId, replyId),
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
      await db.insert(schema.reactions).values({ userId: user.id, replyId, kind: body.kind })
      operation = 'INSERT'
    }

    // 답글 점수 (공감/도파민)만 갱신 브로드캐스트
    const result = await db.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM reactions WHERE reply_id = ${replyId} AND kind = 'empathy') AS empathy,
        (SELECT COUNT(*)::int FROM reactions WHERE reply_id = ${replyId} AND kind = 'dopamine') AS dopamine
    `)
    const agg = result.rows[0] as { empathy: number; dopamine: number } | undefined
    broadcast(pair.issue.id, 'reaction', {
      targetType: 'reply',
      targetId: replyId,
      empathy: Number(agg?.empathy ?? 0),
      dopamine: Number(agg?.dopamine ?? 0),
    })

    return ok({ operation, kind: body.kind })
  })
}
