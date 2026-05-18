'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
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
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="text-xl font-semibold">회원가입</h1>
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
          {err && <p className="text-sm text-red-600">{err}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? '가입 중...' : '가입하기'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-neutral-600">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="font-medium underline">
            로그인
          </Link>
        </p>
      </Card>
    </div>
  )
}
