'use client'

import { useState } from 'react'
import { Button, Card, Input, Textarea } from './ui'

export interface BanTarget {
  userId: string
  nickname: string
}

interface Props {
  target: BanTarget
  defaultMemo?: string
  onClose: () => void
  onApplied?: () => void
}

type Unit = 'hour' | 'day'

const PRESETS: Array<{ label: string; unit: Unit; value: number }> = [
  { label: '1시간', unit: 'hour', value: 1 },
  { label: '6시간', unit: 'hour', value: 6 },
  { label: '24시간', unit: 'hour', value: 24 },
  { label: '3일', unit: 'day', value: 3 },
  { label: '7일', unit: 'day', value: 7 },
  { label: '30일', unit: 'day', value: 30 },
]

function expiresAtFromDuration(value: number, unit: Unit): Date {
  const mult = unit === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  return new Date(Date.now() + value * mult)
}

export function BanActionModal({ target, defaultMemo, onClose, onApplied }: Props) {
  const [unit, setUnit] = useState<Unit>('day')
  const [value, setValue] = useState<number>(7)
  const [memo, setMemo] = useState(defaultMemo ?? '')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const expiresAt = expiresAtFromDuration(value, unit)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (value <= 0) {
      setErr('1 이상 입력하세요.')
      return
    }
    setLoading(true)
    setErr(null)
    const res = await fetch(`/api/admin/users/${target.userId}/ban`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expiresAt: expiresAt.toISOString(), memo: memo.trim() || undefined }),
    })
    setLoading(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setErr(j.error ?? '실패')
      return
    }
    onApplied?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
      <Card className="w-full max-w-md">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--arena-red)]">BAN</p>
        <h2 className="mt-1 text-lg font-black text-white">
          {target.nickname} <span className="text-xs font-bold text-white/45">밴 적용</span>
        </h2>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/45">기간 프리셋</p>
            <div className="flex flex-wrap gap-1">
              {PRESETS.map((p) => (
                <button
                  type="button"
                  key={`${p.unit}-${p.value}`}
                  onClick={() => {
                    setUnit(p.unit)
                    setValue(p.value)
                  }}
                  className={`rounded-md border px-2.5 py-1 text-xs font-black transition ${
                    unit === p.unit && value === p.value
                      ? 'border-[var(--arena-red)] bg-[var(--arena-red)]/20 text-white'
                      : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-[1fr_120px] gap-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-white/45">
              직접 입력
              <Input
                type="number"
                min={1}
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
                required
              />
            </label>
            <label className="block text-[10px] font-black uppercase tracking-widest text-white/45">
              단위
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as Unit)}
                className="h-10 w-full rounded-md border border-white/12 bg-black/40 px-3 text-sm font-bold text-white outline-none"
              >
                <option value="hour">시간</option>
                <option value="day">일</option>
              </select>
            </label>
          </div>
          <p className="text-[11px] font-bold text-white/55">
            → 해제 시각:{' '}
            <span className="font-mono font-black text-white/85">
              {expiresAt.toLocaleString('ko-KR')}
            </span>
          </p>
          <Textarea
            placeholder="사유 메모 (선택)"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
            maxLength={500}
          />
          {err && <p className="text-xs font-bold text-[var(--arena-red)]">{err}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" variant="danger" disabled={loading}>
              {loading ? '적용 중...' : '밴 적용'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
