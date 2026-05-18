import { and, desc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/app/_lib/db'
import { deriveIssueStatus } from '@/app/_lib/domain/issue-status'
import { handle, ok } from '@/app/_lib/http'

export async function GET(req: Request) {
  return handle(async () => {
    const url = new URL(req.url)
    const statusFilter = url.searchParams.get('status')
    const visibleStatuses: Array<'ACTIVE' | 'RESULT'> =
      statusFilter === 'ACTIVE' ? ['ACTIVE'] : statusFilter === 'RESULT' ? ['RESULT'] : ['ACTIVE', 'RESULT']

    const rows = await db
      .select()
      .from(schema.issues)
      .where(inArray(schema.issues.status, visibleStatuses))
      .orderBy(desc(schema.issues.createdAt))

    const now = new Date()
    const live = rows.map((r) => ({
      ...r,
      derivedStatus: deriveIssueStatus(now, {
        opensAt: r.opensAt,
        closesAt: r.closesAt,
        resultAt: r.resultAt,
      }),
    }))
    return ok({ issues: live })
  })
}
