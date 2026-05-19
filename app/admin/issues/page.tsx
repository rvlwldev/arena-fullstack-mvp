import { desc } from 'drizzle-orm'
import { AppShell } from '@/app/_components/AppShell'
import { db, schema } from '@/app/_lib/db'
import { AdminIssuesClient } from './AdminIssuesClient'

export const dynamic = 'force-dynamic'

export default async function AdminIssuesPage() {
  const rows = await db.select().from(schema.issues).orderBy(desc(schema.issues.createdAt))
  return (
    <AppShell wide>
      <AdminIssuesClient
        initial={rows.map((r) => ({
          id: r.id,
          title: r.title,
          sideALabel: r.sideALabel,
          sideASummary: r.sideASummary,
          sideBLabel: r.sideBLabel,
          sideBSummary: r.sideBSummary,
          opensAt: r.opensAt.toISOString(),
          closesAt: r.closesAt.toISOString(),
          resultAt: r.resultAt.toISOString(),
          status: r.status,
        }))}
      />
    </AppShell>
  )
}
