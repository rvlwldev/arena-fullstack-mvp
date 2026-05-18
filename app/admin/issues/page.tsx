import { desc } from 'drizzle-orm'
import { db, schema } from '@/app/_lib/db'
import { AdminIssuesClient } from './AdminIssuesClient'

export const dynamic = 'force-dynamic'

export default async function AdminIssuesPage() {
  const rows = await db.select().from(schema.issues).orderBy(desc(schema.issues.createdAt))
  return <AdminIssuesClient initial={rows} />
}
