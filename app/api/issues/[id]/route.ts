import { eq } from 'drizzle-orm'
import { db, schema } from '@/app/_lib/db'
import { deriveIssueStatus } from '@/app/_lib/domain/issue-status'
import { handle, fail, ok } from '@/app/_lib/http'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params
    const [issue] = await db.select().from(schema.issues).where(eq(schema.issues.id, id)).limit(1)
    if (!issue) return fail(404, '이슈를 찾을 수 없습니다.')
    if (issue.status === 'ARCHIVED' || issue.status === 'CLEANED' || issue.status === 'DRAFT') {
      return fail(404, '이슈를 찾을 수 없습니다.')
    }
    const derivedStatus = deriveIssueStatus(new Date(), {
      opensAt: issue.opensAt,
      closesAt: issue.closesAt,
      resultAt: issue.resultAt,
    })
    return ok({ issue: { ...issue, derivedStatus } })
  })
}
