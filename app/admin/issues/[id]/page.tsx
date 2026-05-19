import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { AppShell } from '@/app/_components/AppShell'
import { db, schema } from '@/app/_lib/db'
import { IssueLogsClient } from './IssueLogsClient'

export const dynamic = 'force-dynamic'

export default async function AdminIssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [issue] = await db.select().from(schema.issues).where(eq(schema.issues.id, id)).limit(1)
  if (!issue) notFound()

  return (
    <AppShell wide>
      <div className="mb-3 flex items-center gap-2 text-xs font-bold text-white/55">
        <Link href="/admin/issues" className="hover:text-white">
          ← 이슈 목록
        </Link>
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">로그</p>
      <h1 className="mt-1 text-2xl font-black text-white">{issue.title}</h1>
      <p className="mt-1 text-xs font-bold text-white/55">
        {issue.sideALabel} <span className="text-white/30">vs</span> {issue.sideBLabel}
      </p>
      <IssueLogsClient issueId={issue.id} />
    </AppShell>
  )
}
