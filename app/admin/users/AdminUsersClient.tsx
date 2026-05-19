'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Input, Pill } from '@/app/_components/ui'
import { BanActionModal, type BanTarget } from '@/app/_components/BanActionModal'
import { remainingHumanKR } from '@/app/_lib/format'

interface UserRow {
  id: string
  email: string
  nickname: string
  role: 'USER' | 'ADMIN'
  createdAt: string
  bannedAt: string | null
  banExpiresAt: string | null
  isBanned: boolean
  banMemo: string | null
}

interface UsersResponse {
  users: UserRow[]
  page: number
  size: number
  total: number
  totalPages: number
}

export function AdminUsersClient() {
  const [q, setQ] = useState('')
  const [appliedQ, setAppliedQ] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<UsersResponse | null>(null)
  const [target, setTarget] = useState<BanTarget | null>(null)

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (appliedQ) params.set('q', appliedQ)
    params.set('page', String(page))
    params.set('size', '20')
    const res = await fetch(`/api/admin/users?${params.toString()}`)
    if (res.ok) setData(await res.json())
  }, [appliedQ, page])

  useEffect(() => {
    load()
  }, [load])

  const search = () => {
    setPage(1)
    setAppliedQ(q.trim())
  }

  const liftBan = async (u: UserRow) => {
    if (!confirm(`${u.nickname} 밴 해제?`)) return
    const res = await fetch(`/api/admin/users/${u.id}/ban`, { method: 'DELETE' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error ?? '실패')
      return
    }
    alert('해제 완료')
    load()
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
        {appliedQ && (
          <p className="mt-2 text-[11px] font-bold text-white/55">
            검색어: <span className="font-mono text-white/85">{appliedQ}</span>
            <button
              type="button"
              onClick={() => {
                setQ('')
                setAppliedQ('')
                setPage(1)
              }}
              className="ml-2 underline hover:text-white"
            >
              초기화
            </button>
          </p>
        )}
      </Card>

      {!data ? (
        <p className="text-sm font-bold text-white/45">로딩 중...</p>
      ) : (
        <>
          <p className="text-[11px] font-bold text-white/45">
            총 {data.total.toLocaleString('ko-KR')}명 · {data.page} / {data.totalPages} 페이지
          </p>
          <ul className="space-y-2">
            {data.users.map((u) => (
              <li key={u.id}>
                <UserCard u={u} onBan={(t) => setTarget(t)} onLift={() => liftBan(u)} />
              </li>
            ))}
          </ul>
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onChange={(p) => {
              setPage(p)
              window.scrollTo({ top: 0 })
            }}
          />
        </>
      )}

      {target && (
        <BanActionModal
          target={target}
          onClose={() => setTarget(null)}
          onApplied={() => {
            alert(`${target.nickname} 밴 적용 완료`)
            load()
          }}
        />
      )}
    </div>
  )
}

function UserCard({
  u,
  onBan,
  onLift,
}: {
  u: UserRow
  onBan: (t: BanTarget) => void
  onLift: () => void
}) {
  return (
    <Card className={u.isBanned ? 'border-[var(--arena-red)]/40 bg-[var(--arena-red)]/[0.04]' : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-black text-white">
            {u.nickname}{' '}
            <span className="text-[11px] font-bold text-white/45">{u.email}</span>
          </p>
          <p className="mt-0.5 text-[10px] font-bold text-white/45">
            {new Date(u.createdAt).toLocaleString('ko-KR')} 가입
          </p>
          {u.isBanned && u.banExpiresAt && (
            <p className="mt-1 text-[11px] font-bold text-[var(--arena-red)]">
              🚫 {remainingHumanKR(u.banExpiresAt)}{' '}
              <span className="text-white/55">— 사유: {u.banMemo ?? '(없음)'}</span>
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Pill tone={u.role === 'ADMIN' ? 'amber' : u.isBanned ? 'right' : 'neutral'}>
            {u.role === 'ADMIN' ? 'ADMIN' : u.isBanned ? 'BANNED' : 'USER'}
          </Pill>
          {u.role !== 'ADMIN' && !u.isBanned && (
            <Button size="sm" variant="danger" onClick={() => onBan({ userId: u.id, nickname: u.nickname })}>
              밴
            </Button>
          )}
          {u.role !== 'ADMIN' && u.isBanned && (
            <Button size="sm" variant="secondary" onClick={onLift}>
              해제
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (p: number) => void
}) {
  if (totalPages <= 1) return null
  const windowSize = 5
  const start = Math.max(1, page - Math.floor(windowSize / 2))
  const end = Math.min(totalPages, start + windowSize - 1)
  const adjStart = Math.max(1, end - windowSize + 1)
  const pages: number[] = []
  for (let i = adjStart; i <= end; i++) pages.push(i)
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => onChange(1)}>
        «
      </Button>
      <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => onChange(page - 1)}>
        ‹
      </Button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`h-8 min-w-8 whitespace-nowrap rounded-md px-2 text-xs font-black transition ${
            p === page
              ? 'bg-white text-neutral-900'
              : 'border border-white/15 bg-white/5 text-white/70 hover:bg-white/10'
          }`}
        >
          {p}
        </button>
      ))}
      <Button size="sm" variant="secondary" disabled={page === totalPages} onClick={() => onChange(page + 1)}>
        ›
      </Button>
      <Button size="sm" variant="secondary" disabled={page === totalPages} onClick={() => onChange(totalPages)}>
        »
      </Button>
    </div>
  )
}
