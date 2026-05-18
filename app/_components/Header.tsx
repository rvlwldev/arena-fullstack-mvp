'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from './ui'

interface Me {
  id: string
  nickname: string
  role: 'USER' | 'ADMIN'
}

export function Header() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => setMe(d.user))
      .catch(() => setMe(null))
  }, [])

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setMe(null)
    router.push('/')
    router.refresh()
  }

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          RED <span className="text-red-600">VS</span> BLUE
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {me ? (
            <>
              {me.role === 'ADMIN' && (
                <Link href="/admin" className="text-neutral-700 hover:text-neutral-900">
                  관리자
                </Link>
              )}
              <span className="text-neutral-500">{me.nickname}</span>
              <Button size="sm" variant="secondary" onClick={logout}>
                로그아웃
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-neutral-700 hover:text-neutral-900">
                로그인
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-white hover:bg-neutral-800"
              >
                가입
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
