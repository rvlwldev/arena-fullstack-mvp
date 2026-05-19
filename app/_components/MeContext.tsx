'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export interface MeUser {
  id: string
  nickname: string
  role: 'USER' | 'ADMIN'
  ban: {
    expiresAt: string
    memo: string | null
    startsAt: string
  } | null
}

interface MeContextValue {
  me: MeUser | null
  loading: boolean
  refresh: () => Promise<void>
  setMe: (m: MeUser | null) => void
}

const MeContext = createContext<MeContextValue | null>(null)

export function MeProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const d = await res.json()
        setMe(d.user)
      } else {
        setMe(null)
      }
    } catch {
      setMe(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = useMemo(() => ({ me, loading, refresh, setMe }), [me, loading, refresh])
  return <MeContext.Provider value={value}>{children}</MeContext.Provider>
}

export function useMe(): MeContextValue {
  const ctx = useContext(MeContext)
  if (!ctx) throw new Error('useMe must be used inside MeProvider')
  return ctx
}
