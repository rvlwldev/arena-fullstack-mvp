'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { AppShell } from '../_components/AppShell'
import { Button, Card, Input } from '../_components/ui'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErr(null)
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, nickname, password }),
    })
    setLoading(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setErr(j.error ?? '가입 실패')
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <AppShell>
      <div className="mx-auto mt-6 max-w-md">
        <Card>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">IDENTITY</p>
          <h1 className="mt-2 text-2xl font-black text-white">전장 이름을 새긴다</h1>
          <p className="mt-1 text-xs font-bold text-white/55">호사유피 인사유명. 너의 닉네임을 새겨라.</p>
          <form onSubmit={submit} className="mt-5 space-y-3">
            <Input type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input
              type="text"
              placeholder="닉네임 (2~20자)"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              minLength={2}
              maxLength={20}
              required
            />
            <Input
              type="password"
              placeholder="비밀번호 (8자 이상)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            {err && <p className="text-xs font-bold text-[var(--arena-red)]">{err}</p>}
            <Button type="submit" variant="gradient" disabled={loading} className="w-full">
              {loading ? '가입 중...' : '가입하고 입장'}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs font-bold text-white/55">
            이미 계정 있어?{' '}
            <Link href="/login" className="text-white underline">
              로그인
            </Link>
          </p>
        </Card>
      </div>
    </AppShell>
  )
}
