import type { ResponseCookies } from 'next/dist/server/web/spec-extension/cookies'
import { env } from '../env'

export const ACCESS_COOKIE = 'access_token'
export const REFRESH_COOKIE = 'refresh_token'

interface CookieJar {
  set(name: string, value: string, options?: Record<string, unknown>): void
  delete(name: string): void
}

export function setAuthCookies(
  jar: CookieJar | ResponseCookies,
  tokens: { access: string; refresh: string },
) {
  const e = env()
  jar.set(ACCESS_COOKIE, tokens.access, {
    httpOnly: true,
    secure: e.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: e.ACCESS_TOKEN_TTL,
  })
  jar.set(REFRESH_COOKIE, tokens.refresh, {
    httpOnly: true,
    secure: e.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: e.REFRESH_TOKEN_TTL,
  })
}

export function clearAuthCookies(jar: CookieJar | ResponseCookies) {
  jar.delete(ACCESS_COOKIE)
  jar.delete(REFRESH_COOKIE)
}
