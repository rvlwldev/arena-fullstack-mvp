import Link from 'next/link'
import { Card, Pill } from './_components/ui'
import { db, schema } from './_lib/db'
import { desc, inArray } from 'drizzle-orm'
import { deriveIssueStatus } from './_lib/domain/issue-status'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const rows = await db
    .select()
    .from(schema.issues)
    .where(inArray(schema.issues.status, ['ACTIVE', 'RESULT']))
    .orderBy(desc(schema.issues.createdAt))

  const now = new Date()

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">진행 중인 이슈</h1>
        <p className="mt-1 text-sm text-neutral-600">의견을 등록하고 진영에 한 표 던지세요.</p>
      </header>
      {rows.length === 0 ? (
        <Card>
          <p className="text-neutral-500">아직 공개된 이슈가 없습니다.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const status = deriveIssueStatus(now, r)
            return (
              <li key={r.id}>
                <Link href={`/issues/${r.id}`}>
                  <Card className="transition hover:border-neutral-400">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">{r.title}</h2>
                        <p className="mt-1 text-sm text-neutral-600">
                          <Pill tone="left">{r.sideALabel}</Pill> vs <Pill tone="right">{r.sideBLabel}</Pill>
                        </p>
                      </div>
                      <Pill tone="neutral">{status}</Pill>
                    </div>
                  </Card>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
