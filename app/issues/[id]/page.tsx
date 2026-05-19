import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { db, schema } from '@/app/_lib/db'
import { deriveIssueStatus } from '@/app/_lib/domain/issue-status'
import { getCurrentUser } from '@/app/_lib/auth/session'
import { ArenaBattleClient } from './ArenaBattleClient'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [issue] = await db.select().from(schema.issues).where(eq(schema.issues.id, id)).limit(1)
  return { title: issue?.title ?? '전장' }
}

export default async function IssuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [issue] = await db.select().from(schema.issues).where(eq(schema.issues.id, id)).limit(1)
  if (!issue) notFound()
  if (issue.status === 'DRAFT' || issue.status === 'ARCHIVED' || issue.status === 'CLEANED') notFound()
  const derivedStatus = deriveIssueStatus(new Date(), issue)
  const me = await getCurrentUser()

  return (
    <ArenaBattleClient
      issue={{
        id: issue.id,
        title: issue.title,
        sideALabel: issue.sideALabel,
        sideASummary: issue.sideASummary,
        sideBLabel: issue.sideBLabel,
        sideBSummary: issue.sideBSummary,
        opensAt: issue.opensAt.toISOString(),
        closesAt: issue.closesAt.toISOString(),
        resultAt: issue.resultAt.toISOString(),
        status: issue.status,
        derivedStatus,
      }}
      me={me}
    />
  )
}
