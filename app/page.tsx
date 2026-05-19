import Link from 'next/link'
import { desc, inArray, sql } from 'drizzle-orm'
import { AppShell } from './_components/AppShell'
import { Card, Pill, StatNumber, StatusBadge } from './_components/ui'
import { TeamPill } from './_components/TeamPill'
import { db, schema } from './_lib/db'
import { deriveIssueStatus } from './_lib/domain/issue-status'
import { formatCountKR, elapsedSecondsSince, formatHHMMSS } from './_lib/format'

export const dynamic = 'force-dynamic'

interface IssueStat {
  participants: number
  comments: number
  reactions: number
}

async function loadIssueStats(ids: string[]): Promise<Map<string, IssueStat>> {
  const map = new Map<string, IssueStat>()
  if (ids.length === 0) return map
  const result = await db.execute(sql`
    SELECT
      i.id,
      (SELECT COUNT(DISTINCT u)::int FROM (
        SELECT user_id AS u FROM comments WHERE issue_id = i.id AND deleted_at IS NULL
        UNION
        SELECT user_id AS u FROM chats WHERE issue_id = i.id AND deleted_at IS NULL
      ) AS p) AS participants,
      (SELECT COUNT(*)::int FROM comments WHERE issue_id = i.id AND deleted_at IS NULL) AS comments,
      (
        (SELECT COUNT(*)::int FROM reactions r JOIN comments c ON c.id = r.comment_id WHERE c.issue_id = i.id) +
        (SELECT COUNT(*)::int FROM reactions r JOIN replies rp ON rp.id = r.reply_id JOIN comments c ON c.id = rp.comment_id WHERE c.issue_id = i.id)
      ) AS reactions
    FROM issues i WHERE i.id = ANY(${sql.raw(`ARRAY[${ids.map((id) => `'${id}'`).join(',')}]::uuid[]`)})
  `)
  for (const row of result.rows) {
    const r = row as { id: string; participants: number; comments: number; reactions: number }
    map.set(r.id, {
      participants: Number(r.participants),
      comments: Number(r.comments),
      reactions: Number(r.reactions),
    })
  }
  return map
}

export default async function HomePage() {
  const rows = await db
    .select()
    .from(schema.issues)
    .where(inArray(schema.issues.status, ['ACTIVE', 'RESULT']))
    .orderBy(desc(schema.issues.createdAt))

  const stats = await loadIssueStats(rows.map((r) => r.id))
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
            const st = stats.get(r.id) ?? { participants: 0, comments: 0, reactions: 0 }
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
                      <StatNumber label="참가" value={formatCountKR(st.participants)} />
                      <StatNumber label="댓글" value={formatCountKR(st.comments)} />
                      <StatNumber label="반응" value={formatCountKR(st.reactions)} />
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
