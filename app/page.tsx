import Link from 'next/link'
import { sql } from 'drizzle-orm'
import { AppShell } from './_components/AppShell'
import { Card, Pill, StatNumber, StatusBadge } from './_components/ui'
import { TeamPill } from './_components/TeamPill'
import { db } from './_lib/db'
import { deriveIssueStatus, type IssueStatus } from './_lib/domain/issue-status'
import { formatCountKR, elapsedSecondsSince, formatHHMMSS } from './_lib/format'

export const dynamic = 'force-dynamic'

interface IssueListRow {
  id: string
  title: string
  sideALabel: string
  sideBLabel: string
  opensAt: Date
  closesAt: Date
  resultAt: Date
  status: IssueStatus
  participants: number
  comments: number
  reactions: number
}

async function loadIssuesWithStats(): Promise<IssueListRow[]> {
  // 단일 쿼리: 이슈 + 참가/댓글/반응 집계
  // - participants: comments/chats user_id UNION DISTINCT
  // - comments: 활성 의견 수
  // - reactions: 의견·답글에 달린 reaction 수
  const result = await db.execute(sql`
    SELECT
      i.id, i.title, i.side_a_label, i.side_b_label,
      i.opens_at, i.closes_at, i.result_at, i.status,
      COALESCE(stat.participants, 0) AS participants,
      COALESCE(stat.comments, 0)     AS comments,
      COALESCE(stat.reactions, 0)    AS reactions
    FROM issues i
    LEFT JOIN LATERAL (
      SELECT
        (SELECT COUNT(DISTINCT u)::int FROM (
          SELECT user_id AS u FROM comments WHERE issue_id = i.id AND deleted_at IS NULL
          UNION
          SELECT user_id AS u FROM chats    WHERE issue_id = i.id AND deleted_at IS NULL
        ) p) AS participants,
        (SELECT COUNT(*)::int FROM comments WHERE issue_id = i.id AND deleted_at IS NULL) AS comments,
        (
          (SELECT COUNT(*)::int FROM reactions r JOIN comments c ON c.id = r.comment_id WHERE c.issue_id = i.id) +
          (SELECT COUNT(*)::int FROM reactions r JOIN replies rp ON rp.id = r.reply_id JOIN comments c ON c.id = rp.comment_id WHERE c.issue_id = i.id)
        ) AS reactions
    ) stat ON TRUE
    WHERE i.status IN ('ACTIVE', 'RESULT')
    ORDER BY i.created_at DESC
  `)
  return result.rows.map((row) => {
    const r = row as {
      id: string; title: string; side_a_label: string; side_b_label: string
      opens_at: string | Date; closes_at: string | Date; result_at: string | Date
      status: IssueStatus
      participants: number; comments: number; reactions: number
    }
    return {
      id: r.id,
      title: r.title,
      sideALabel: r.side_a_label,
      sideBLabel: r.side_b_label,
      opensAt: new Date(r.opens_at),
      closesAt: new Date(r.closes_at),
      resultAt: new Date(r.result_at),
      status: r.status,
      participants: Number(r.participants),
      comments: Number(r.comments),
      reactions: Number(r.reactions),
    }
  })
}

export default async function HomePage() {
  const rows = await loadIssuesWithStats()
  const now = new Date()

  return (
    <AppShell>
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">현재 전장</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">진행중인 이슈</h1>
          <p className="mt-1 text-xs font-bold text-white/55 sm:text-sm">진영 골라서 한 줄로 전장 박살내라.</p>
        </div>
        <Pill tone="live">LIVE</Pill>
      </header>

      {rows.length === 0 ? (
        <Card className="mt-6">
          <p className="text-sm font-bold text-white/55">아직 공개된 전장이 없다. 관리자가 곧 연다.</p>
        </Card>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => {
            const status = deriveIssueStatus(now, r)
            const elapsed = elapsedSecondsSince(r.opensAt)
            return (
              <li key={r.id}>
                <Link href={`/issues/${r.id}`} className="block">
                  <Card className="transition hover:border-white/25">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-black leading-tight text-white sm:text-xl">{r.title}</h2>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                          <TeamPill team="left" label={r.sideALabel} />
                          <span className="font-mono text-white/30">vs</span>
                          <TeamPill team="right" label={r.sideBLabel} />
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <StatusBadge status={status} />
                        {status === 'ACTIVE' && (
                          <span className="font-mono text-[10px] font-bold text-white/45">
                            {formatHHMMSS(elapsed)} 경과
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <StatNumber label="참가" value={formatCountKR(r.participants)} />
                      <StatNumber label="댓글" value={formatCountKR(r.comments)} />
                      <StatNumber label="반응" value={formatCountKR(r.reactions)} />
                    </div>
                  </Card>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </AppShell>
  )
}
