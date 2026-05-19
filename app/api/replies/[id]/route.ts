import { z } from 'zod'
import { and, eq, isNull } from 'drizzle-orm'
import { db, schema } from '@/app/_lib/db'
import { requireActiveUser } from '@/app/_lib/auth/session'
import { handle, fail, ok, noContent } from '@/app/_lib/http'
import { canEditComment } from '@/app/_lib/domain/edit-window'
import { deriveIssueStatus } from '@/app/_lib/domain/issue-status'
import { broadcast } from '@/app/_lib/sse-hub'

const patchSchema = z.object({ body: z.string().min(1).max(1000) })

async function loadReplyChain(replyId: string) {
  const [row] = await db
    .select({ reply: schema.replies, comment: schema.comments, issue: schema.issues })
    .from(schema.replies)
    .innerJoin(schema.comments, eq(schema.comments.id, schema.replies.commentId))
    .innerJoin(schema.issues, eq(schema.issues.id, schema.comments.issueId))
    .where(and(eq(schema.replies.id, replyId), isNull(schema.replies.deletedAt)))
    .limit(1)
  return row
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireActiveUser()
    const { id } = await ctx.params
    const { body } = patchSchema.parse(await req.json())

    const pair = await loadReplyChain(id)
    if (!pair) return fail(404, '답글을 찾을 수 없습니다.')
    if (pair.reply.userId !== user.id) return fail(403, '본인 답글만 수정할 수 있습니다.')

    const issueStatus = deriveIssueStatus(new Date(), {
      opensAt: pair.issue.opensAt,
      closesAt: pair.issue.closesAt,
      resultAt: pair.issue.resultAt,
    })
    const dec = canEditComment(new Date(), {
      createdAt: pair.reply.createdAt,
      deletedAt: pair.reply.deletedAt,
      issueStatus,
    })
    if (!dec.ok) return fail(409, message(dec.reason))

    const [updated] = await db
      .update(schema.replies)
      .set({ body, updatedAt: new Date() })
      .where(eq(schema.replies.id, id))
      .returning()

    broadcast(pair.issue.id, 'reply', { type: 'updated', reply: updated })
    return ok({ reply: updated })
  })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireActiveUser()
    const { id } = await ctx.params

    const pair = await loadReplyChain(id)
    if (!pair) return fail(404, '답글을 찾을 수 없습니다.')
    if (pair.reply.userId !== user.id) return fail(403, '본인 답글만 삭제할 수 있습니다.')

    const issueStatus = deriveIssueStatus(new Date(), {
      opensAt: pair.issue.opensAt,
      closesAt: pair.issue.closesAt,
      resultAt: pair.issue.resultAt,
    })
    const dec = canEditComment(new Date(), {
      createdAt: pair.reply.createdAt,
      deletedAt: pair.reply.deletedAt,
      issueStatus,
    })
    if (!dec.ok) return fail(409, message(dec.reason))

    await db.update(schema.replies).set({ deletedAt: new Date() }).where(eq(schema.replies.id, id))
    broadcast(pair.issue.id, 'reply', { type: 'deleted', replyId: id })
    return noContent()
  })
}

function message(reason: 'DELETED' | 'WINDOW_EXPIRED' | 'ISSUE_NOT_ACTIVE'): string {
  switch (reason) {
    case 'DELETED':
      return '이미 삭제된 답글입니다.'
    case 'WINDOW_EXPIRED':
      return '답글 수정/삭제 가능 시간(5분)이 지났습니다.'
    case 'ISSUE_NOT_ACTIVE':
      return '이슈가 진행 중이 아닙니다.'
  }
}
