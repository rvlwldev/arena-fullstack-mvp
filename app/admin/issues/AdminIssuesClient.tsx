'use client'

import { useState } from 'react'
import { Button, Card, Input, Pill, Textarea } from '@/app/_components/ui'

interface IssueRow {
  id: string
  title: string
  sideALabel: string
  sideASummary: string
  sideBLabel: string
  sideBSummary: string
  opensAt: string | Date
  closesAt: string | Date
  resultAt: string | Date
  status: 'DRAFT' | 'ACTIVE' | 'RESULT' | 'ARCHIVED' | 'CLEANED'
}

function toLocalInput(d: Date | string) {
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
    if (!confirm('정말 삭제하시겠어요? 관련 의견/투표/채팅이 모두 사라집니다.')) return
    const res = await fetch(`/api/admin/issues/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error ?? '삭제 실패')
      return
    }
    refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">이슈 관리</h1>
        <Button onClick={() => setCreating((v) => !v)}>{creating ? '취소' : '새 이슈'}</Button>
      </div>

      {creating && <IssueForm onSaved={() => { setCreating(false); refresh() }} />}

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
  const [opensAt, setOpensAt] = useState(toLocalInput(initial?.opensAt ?? new Date()))
  const [closesAt, setClosesAt] = useState(toLocalInput(initial?.closesAt ?? new Date(Date.now() + 3600_000)))
  const [resultAt, setResultAt] = useState(toLocalInput(initial?.resultAt ?? new Date(Date.now() + 7200_000)))
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
    const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
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
        <Input placeholder="이슈 제목" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Input placeholder="A 진영 라벨" value={sideALabel} onChange={(e) => setSideALabel(e.target.value)} required />
            <Textarea placeholder="A 진영 요약" value={sideASummary} onChange={(e) => setSideASummary(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Input placeholder="B 진영 라벨" value={sideBLabel} onChange={(e) => setSideBLabel(e.target.value)} required />
            <Textarea placeholder="B 진영 요약" value={sideBSummary} onChange={(e) => setSideBSummary(e.target.value)} required />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-xs text-neutral-600">
            오픈 시각
            <Input type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} required />
          </label>
          <label className="block text-xs text-neutral-600">
            마감 시각
            <Input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} required />
          </label>
          <label className="block text-xs text-neutral-600">
            결과 종료 시각
            <Input type="datetime-local" value={resultAt} onChange={(e) => setResultAt(e.target.value)} required />
          </label>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <Button type="submit">{initial ? '수정' : '등록'}</Button>
      </form>
    </Card>
  )
}

function IssueEditCard({ row, onChanged, onRemove }: { row: IssueRow; onChanged: () => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false)
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{row.title}</h3>
          <p className="mt-1 text-sm text-neutral-600">
            <Pill tone="A">{row.sideALabel}</Pill> vs <Pill tone="B">{row.sideBLabel}</Pill>
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            opens: {new Date(row.opensAt).toLocaleString()} / closes: {new Date(row.closesAt).toLocaleString()} / result: {new Date(row.resultAt).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Pill tone="neutral">{row.status}</Pill>
          <div className="flex gap-1">
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
          <IssueForm initial={row} onSaved={() => { setEditing(false); onChanged() }} />
        </div>
      )}
    </Card>
  )
}
