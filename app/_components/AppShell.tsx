'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { Logo } from './Logo'

interface Me {
  id: string
  nickname: string
  role: 'USER' | 'ADMIN'
}

export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
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

  const widthCls = wide ? 'max-w-5xl' : 'max-w-4xl'

  return (
    <div className="relative min-h-dvh w-full overflow-x-hidden bg-[var(--arena-bg)] text-[var(--arena-text)]">
      <div className="pointer-events-none fixed inset-0 scanlines opacity-[0.12]" />
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(255,43,74,0.14),transparent),radial-gradient(ellipse_60%_40%_at_100%_50%,rgba(47,123,255,0.10),transparent)]"
        aria-hidden
      />

      <header className="relative z-20 border-b border-white/10 bg-[#07070c]/92 backdrop-blur-md">
        <div className={`mx-auto flex w-full ${widthCls} items-center justify-between gap-3 px-4 py-3 sm:px-6`}>
          <Logo />
          <nav className="flex items-center gap-2 text-xs font-black sm:text-sm">
            {me ? (
              <>
                {me.role === 'ADMIN' && (
                  <Link
                    href="/admin"
                    className="rounded border border-white/15 bg-white/5 px-2.5 py-1 text-white/80 hover:bg-white/10"
                  >
                    운영
                  </Link>
                )}
                <span className="hidden text-white/60 sm:inline">{me.nickname}</span>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded border border-white/15 bg-white/5 px-2.5 py-1 text-white/80 hover:bg-white/10"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded border border-white/15 bg-white/5 px-2.5 py-1 text-white/80 hover:bg-white/10"
                >
                  로그인
                </Link>
                <Link
                  href="/signup"
                  className="rounded bg-gradient-to-r from-[var(--arena-red)] to-[var(--arena-blue)] px-2.5 py-1 text-white"
                >
                  가입
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className={`relative z-10 mx-auto w-full ${widthCls} px-4 py-6 sm:px-6 sm:py-8`}>
        {children}
      </main>
    </div>
  )
}
