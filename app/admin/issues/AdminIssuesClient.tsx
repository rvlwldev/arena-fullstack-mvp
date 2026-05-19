'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button, Card, Input, StatusBadge, Textarea } from '@/app/_components/ui'
import { TeamPill } from '@/app/_components/TeamPill'

interface IssueRow {
  id: string
  title: string
  sideALabel: string
  sideASummary: string
  sideBLabel: string
  sideBSummary: string
  opensAt: string
  closesAt: string
  resultAt: string
  status: 'DRAFT' | 'ACTIVE' | 'RESULT' | 'ARCHIVED' | 'CLEANED'
}

function toLocalInput(d: string) {
  const x = new Date(d)
  const off = x.getTimezoneOffset()
  return new Date(x.getTime() - off * 60_000).toISOString().slice(0, 16)
}

export function AdminIssuesClient({ initial }: { initial: IssueRow[] }) {
  const [rows, setRows] = useState<IssueRow[]>(initial)
  const [creating, setCreating] = useState(false)

  const refresh = async () => {
    const res = await fetch('/api/admin/issues')
    if (res.ok) setRows((await res.json()).issues)
  }

  const remove = async (id: string) => {
    if (!confirm('정말 삭제? 관련 의견·답글·반응·채팅 모두 사라진다.')) return
    const res = await fetch(`/api/admin/issues/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error ?? '실패')
      return
    }
    refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">운영</p>
          <h1 className="mt-1 text-2xl font-black text-white">이슈 관리</h1>
        </div>
        <Button variant="gradient" onClick={() => setCreating((v) => !v)}>
          {creating ? '취소' : '+ 새 전장'}
        </Button>
      </div>

      {creating && (
        <IssueForm
          onSaved={() => {
            setCreating(false)
            refresh()
          }}
        />
      )}

      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id}>
            <IssueEditCard row={r} onChanged={refresh} onRemove={() => remove(r.id)} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function IssueForm({ onSaved, initial }: { onSaved: () => void; initial?: IssueRow }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [sideALabel, setSideALabel] = useState(initial?.sideALabel ?? '')
  const [sideASummary, setSideASummary] = useState(initial?.sideASummary ?? '')
  const [sideBLabel, setSideBLabel] = useState(initial?.sideBLabel ?? '')
  const [sideBSummary, setSideBSummary] = useState(initial?.sideBSummary ?? '')
  const [opensAt, setOpensAt] = useState(toLocalInput(initial?.opensAt ?? new Date().toISOString()))
  const [closesAt, setClosesAt] = useState(
    toLocalInput(initial?.closesAt ?? new Date(Date.now() + 3600_000).toISOString()),
  )
  const [resultAt, setResultAt] = useState(
    toLocalInput(initial?.resultAt ?? new Date(Date.now() + 7200_000).toISOString()),
  )
  const [err, setErr] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    const payload = {
      title,
      sideALabel,
      sideASummary,
      sideBLabel,
      sideBSummary,
      opensAt: new Date(opensAt).toISOString(),
      closesAt: new Date(closesAt).toISOString(),
      resultAt: new Date(resultAt).toISOString(),
    }
    const url = initial ? `/api/admin/issues/${initial.id}` : '/api/admin/issues'
    const method = initial ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setErr(j.error ?? '실패')
      return
    }
    onSaved()
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <Input placeholder="전장 제목" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-[var(--arena-blue)]/30 bg-[var(--arena-blue)]/5 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--arena-blue)]">좌측 진영</p>
            <Input placeholder="라벨" value={sideALabel} onChange={(e) => setSideALabel(e.target.value)} required />
            <Textarea
              placeholder="요약"
              value={sideASummary}
              onChange={(e) => setSideASummary(e.target.value)}
              rows={3}
              required
            />
          </div>
          <div className="space-y-2 rounded-lg border border-[var(--arena-red)]/30 bg-[var(--arena-red)]/5 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--arena-red)]">우측 진영</p>
            <Input placeholder="라벨" value={sideBLabel} onChange={(e) => setSideBLabel(e.target.value)} required />
            <Textarea
              placeholder="요약"
              value={sideBSummary}
              onChange={(e) => setSideBSummary(e.target.value)}
              rows={3}
              required
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-[10px] font-black uppercase tracking-widest text-white/45">
            오픈
            <Input type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} required />
          </label>
          <label className="block text-[10px] font-black uppercase tracking-widest text-white/45">
            마감 (의견·반응 종료)
            <Input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} required />
          </label>
          <label className="block text-[10px] font-black uppercase tracking-widest text-white/45">
            결과 노출 종료
            <Input type="datetime-local" value={resultAt} onChange={(e) => setResultAt(e.target.value)} required />
          </label>
        </div>
        {err && <p className="text-xs font-bold text-[var(--arena-red)]">{err}</p>}
        <Button type="submit" variant="gradient">
          {initial ? '수정 저장' : '전장 등록'}
        </Button>
      </form>
    </Card>
  )
}

function IssueEditCard({
  row,
  onChanged,
  onRemove,
}: {
  row: IssueRow
  onChanged: () => void
  onRemove: () => void
}) {
  const [editing, setEditing] = useState(false)
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-black text-white">{row.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            <TeamPill team="left" label={row.sideALabel} />
            <span className="text-white/30">vs</span>
            <TeamPill team="right" label={row.sideBLabel} />
          </div>
          <p className="mt-1 text-[10px] font-bold tabular-nums text-white/45">
            opens {new Date(row.opensAt).toLocaleString()} · closes {new Date(row.closesAt).toLocaleString()} · result{' '}
            {new Date(row.resultAt).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={row.status} />
          <div className="flex flex-wrap gap-1">
            <Link href={`/admin/issues/${row.id}`}>
              <Button size="sm" variant="secondary">
                로그
              </Button>
            </Link>
            <Button size="sm" variant="secondary" onClick={() => setEditing((v) => !v)}>
              {editing ? '닫기' : '편집'}
            </Button>
            <Button size="sm" variant="danger" onClick={onRemove}>
              삭제
            </Button>
          </div>
        </div>
      </div>
      {editing && (
        <div className="mt-4">
          <IssueForm
            initial={row}
            onSaved={() => {
              setEditing(false)
              onChanged()
            }}
          />
        </div>
      )}
    </Card>
  )
}
