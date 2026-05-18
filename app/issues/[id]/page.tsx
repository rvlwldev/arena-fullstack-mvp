import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { db, schema } from '@/app/_lib/db'
import { deriveIssueStatus } from '@/app/_lib/domain/issue-status'
import { IssueDetailClient } from './IssueDetailClient'
import { getCurrentUser } from '@/app/_lib/auth/session'

export const dynamic = 'force-dynamic'

export default async function IssuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [issue] = await db.select().from(schema.issues).where(eq(schema.issues.id, id)).limit(1)
  if (!issue) notFound()
  const derivedStatus = deriveIssueStatus(new Date(), issue)
  if (derivedStatus === 'ARCHIVED' || issue.status === 'CLEANED' || derivedStatus === 'DRAFT') notFound()

  const me = await getCurrentUser()

  return <IssueDetailClient issue={{ ...issue, derivedStatus }} me={me} />
}
