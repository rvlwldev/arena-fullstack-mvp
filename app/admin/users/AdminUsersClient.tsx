'use client'

import { useEffect, useState } from 'react'
import { Button, Card, Input, Pill, Textarea } from '@/app/_components/ui'

interface UserRow {
  id: string
  email: string
  nickname: string
  role: 'USER' | 'ADMIN'
  createdAt: string
  bannedAt: string | null
}

function plusDays(d: number) {
  const x = new Date(Date.now() + d * 86400 * 1000)
  const off = x.getTimezoneOffset()
  return new Date(x.getTime() - off * 60_000).toISOString().slice(0, 16)
}

export function AdminUsersClient() {
  const [q, setQ] = useState('')
  const [users, setUsers] = useState<UserRow[]>([])
  const [target, setTarget] = useState<UserRow | null>(null)

  const search = async () => {
    const res = await fetch(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`)
    if (res.ok) setUsers((await res.json()).users)
  }

  useEffect(() => {
    search()
  }, [])

  const liftBan = async (u: UserRow) => {
    const res = await fetch(`/api/admin/users/${u.id}/ban`, { method: 'DELETE' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error ?? '실패')
      return
    }
    alert('밴 해제 완료')
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">운영</p>
        <h1 className="mt-1 text-2xl font-black text-white">사용자 관리</h1>
      </div>
      <Card>
        <div className="flex gap-2">
          <Input
            placeholder="이메일 또는 닉네임 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
          />
          <Button variant="secondary" onClick={search}>
            검색
          </Button>
        </div>
      </Card>
      <ul className="space-y-2">
        {users.map((u) => (
          <li key={u.id}>
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-black text-white">
                    {u.nickname}{' '}
                    <span className="text-[11px] font-bold text-white/45">{u.email}</span>
                  </p>
                  <p className="mt-0.5 text-[10px] font-bold text-white/45">
                    {new Date(u.createdAt).toLocaleString()} 가입
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Pill tone={u.role === 'ADMIN' ? 'amber' : 'neutral'}>{u.role}</Pill>
                  {u.role !== 'ADMIN' && (
                    <>
                      <Button size="sm" variant="danger" onClick={() => setTarget(u)}>
                        밴
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => liftBan(u)}>
                        해제
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      {target && <BanModal user={target} onClose={() => setTarget(null)} />}
    </div>
  )
}

function BanModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [until, setUntil] = useState(plusDays(7))
  const [memo, setMemo] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const res = await fetch(`/api/admin/users/${user.id}/ban`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expiresAt: new Date(until).toISOString(), memo: memo || undefined }),
    })
    setLoading(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error ?? '실패')
      return
    }
    alert('밴 적용 완료')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <Card className="w-full max-w-md">
        <h2 className="text-lg font-black text-white">{user.nickname} 밴</h2>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block text-[10px] font-black uppercase tracking-widest text-white/45">
            만료 시각
            <Input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} required />
          </label>
          <Textarea
            placeholder="사유 메모 (선택)"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
            maxLength={500}
          />
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
