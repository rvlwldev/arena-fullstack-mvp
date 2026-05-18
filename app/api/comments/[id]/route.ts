import { z } from 'zod'
import { and, eq, isNull } from 'drizzle-orm'
import { db, schema } from '@/app/_lib/db'
import { requireUser } from '@/app/_lib/auth/session'
import { handle, fail, ok, noContent } from '@/app/_lib/http'
import { canEditComment } from '@/app/_lib/domain/edit-window'
import { deriveIssueStatus } from '@/app/_lib/domain/issue-status'
import { broadcast } from '@/app/_lib/sse-hub'

const patchSchema = z.object({ body: z.string().min(1).max(2000) })

async function loadCommentWithIssue(commentId: string) {
  const [row] = await db
    .select({
      comment: schema.comments,
      issue: schema.issues,
    })
    .from(schema.comments)
    .innerJoin(schema.issues, eq(schema.issues.id, schema.comments.issueId))
    .where(and(eq(schema.comments.id, commentId), isNull(schema.comments.deletedAt)))
    .limit(1)
  return row
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser()
    const { id } = await ctx.params
    const { body } = patchSchema.parse(await req.json())

    const found = await loadCommentWithIssue(id)
    if (!found) return fail(404, '의견을 찾을 수 없습니다.')
    if (found.comment.userId !== user.id) return fail(403, '본인 의견만 수정할 수 있습니다.')

    const issueStatus = deriveIssueStatus(new Date(), {
      opensAt: found.issue.opensAt,
      closesAt: found.issue.closesAt,
      resultAt: found.issue.resultAt,
    })
    const decision = canEditComment(new Date(), {
      createdAt: found.comment.createdAt,
      deletedAt: found.comment.deletedAt,
      issueStatus,
    })
    if (!decision.ok) return fail(409, decisionMessage(decision.reason))

    const [updated] = await db
      .update(schema.comments)
      .set({ body, updatedAt: new Date() })
      .where(eq(schema.comments.id, id))
      .returning()

    await broadcast(found.issue.id, 'comment', { type: 'updated', comment: updated })

    return ok({ comment: updated })
  })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser()
    const { id } = await ctx.params

    const found = await loadCommentWithIssue(id)
    if (!found) return fail(404, '의견을 찾을 수 없습니다.')
    if (found.comment.userId !== user.id) return fail(403, '본인 의견만 삭제할 수 있습니다.')

    const issueStatus = deriveIssueStatus(new Date(), {
      opensAt: found.issue.opensAt,
      closesAt: found.issue.closesAt,
      resultAt: found.issue.resultAt,
    })
    const decision = canEditComment(new Date(), {
      createdAt: found.comment.createdAt,
      deletedAt: found.comment.deletedAt,
      issueStatus,
    })
    if (!decision.ok) return fail(409, decisionMessage(decision.reason))

    await db.update(schema.comments).set({ deletedAt: new Date() }).where(eq(schema.comments.id, id))
    await broadcast(found.issue.id, 'comment', { type: 'deleted', commentId: id })
    return noContent()
  })
}

function decisionMessage(reason: 'DELETED' | 'WINDOW_EXPIRED' | 'ISSUE_NOT_ACTIVE'): string {
  switch (reason) {
    case 'DELETED':
      return '이미 삭제된 의견입니다.'
    case 'WINDOW_EXPIRED':
      return '의견 수정/삭제 가능 시간(5분)이 지났습니다.'
    case 'ISSUE_NOT_ACTIVE':
      return '이슈가 진행 중이 아닙니다.'
  }
}
