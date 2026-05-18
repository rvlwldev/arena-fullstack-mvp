import { cookies } from 'next/headers'
import { REFRESH_COOKIE, clearAuthCookies } from '@/app/_lib/auth/cookies'
import { revokeRefreshToken } from '@/app/_lib/auth/session'
import { handle, noContent } from '@/app/_lib/http'

export async function POST() {
  return handle(async () => {
    const jar = await cookies()
    const refresh = jar.get(REFRESH_COOKIE)?.value
    if (refresh) await revokeRefreshToken(refresh)
    clearAuthCookies(jar)
    return noContent()
  })
}
