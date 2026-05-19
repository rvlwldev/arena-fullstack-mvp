'use client'

import { useEffect, useState } from 'react'
import { Button, Card } from './ui'
import { remainingHumanKR } from '@/app/_lib/format'

const STORAGE_KEY = 'bbalparena-ban-notice-dismissed'

export function BanNoticeModal({
  ban,
  userId,
}: {
  ban: { expiresAt: string; memo: string | null } | null
  userId: string | null
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!ban || !userId) {
      setOpen(false)
      return
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      const dismissed = raw ? (JSON.parse(raw) as Record<string, string>) : {}
      // 같은 ban(만료시각 기준)에 대해 한 번만 띄움
      if (dismissed[userId] === ban.expiresAt) return
    } catch {}
    setOpen(true)
  }, [ban, userId])

  const close = () => {
    if (ban && userId) {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        const dismissed = raw ? (JSON.parse(raw) as Record<string, string>) : {}
        dismissed[userId] = ban.expiresAt
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissed))
      } catch {}
    }
    setOpen(false)
  }

  if (!open || !ban) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
      <Card className="w-full max-w-md border-[var(--arena-red)]/50 bg-[var(--arena-red)]/10">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--arena-red)]">SUSPENDED</p>
        <h2 className="mt-2 text-2xl font-black text-white">이용 정지 상태</h2>
        <p className="mt-3 text-sm font-bold text-white/80">
          관리자가 이 계정을 일정 기간 정지했습니다.
        </p>
        <div className="mt-4 space-y-2 rounded-lg border border-white/10 bg-black/40 p-3">
          <p className="text-xs font-bold text-white/60">
            남은 시간:{' '}
            <span className="font-black text-[var(--arena-red)]">{remainingHumanKR(ban.expiresAt)}</span>
          </p>
          <p className="text-xs font-bold text-white/60">
            해제 시각:{' '}
            <span className="font-mono font-black text-white/85">
              {new Date(ban.expiresAt).toLocaleString('ko-KR')}
            </span>
          </p>
          <p className="text-xs font-bold text-white/60">
            사유:{' '}
            <span className="font-bold text-white/85">{ban.memo ?? '(없음)'}</span>
          </p>
        </div>
        <p className="mt-3 text-[11px] font-bold text-white/55">
          정지 기간 동안 의견·답글·반응·채팅 작성이 불가하며, 보기는 자유입니다.
        </p>
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={close}>
            확인
          </Button>
        </div>
      </Card>
    </div>
  )
}
