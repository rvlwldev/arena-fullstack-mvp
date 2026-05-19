'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { AppShell } from '../_components/AppShell'
import { Button, Card, Input } from '../_components/ui'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErr(null)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    setLoading(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setErr(j.error ?? '로그인 실패')
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <AppShell>
      <div className="mx-auto mt-6 max-w-md">
        <Card>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">LOGIN</p>
          <h1 className="mt-2 text-2xl font-black text-white">전장에 복귀한다</h1>
          <form onSubmit={submit} className="mt-5 space-y-3">
            <Input type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {err && <p className="text-xs font-bold text-[var(--arena-red)]">{err}</p>}
            <Button type="submit" variant="gradient" disabled={loading} className="w-full">
              {loading ? '로그인 중...' : '입장'}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs font-bold text-white/55">
            처음이야?{' '}
            <Link href="/signup" className="text-white underline">
              가입하기
            </Link>
          </p>
        </Card>
      </div>
    </AppShell>
  )
}
