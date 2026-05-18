import { cookies, headers } from 'next/headers'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { db, schema } from '@/app/_lib/db'
import { verifyRefreshToken } from '@/app/_lib/auth/jwt'
import {
  issueTokenPair,
  refreshTokenHash,
  revokeRefreshToken,
} from '@/app/_lib/auth/session'
import { REFRESH_COOKIE, setAuthCookies, clearAuthCookies } from '@/app/_lib/auth/cookies'
import { handle, fail, ok } from '@/app/_lib/http'

export async function POST() {
  return handle(async () => {
    const jar = await cookies()
    const refresh = jar.get(REFRESH_COOKIE)?.value
    if (!refresh) {
      clearAuthCookies(jar)
      return fail(401, '리프레시 토큰이 없습니다.')
    }
    const payload = await verifyRefreshToken(refresh)
    if (!payload) {
      clearAuthCookies(jar)
      return fail(401, '유효하지 않은 리프레시 토큰입니다.')
    }

    const hash = refreshTokenHash(refresh)
    const [stored] = await db
      .select()
      .from(schema.refreshTokens)
      .where(
        and(
          eq(schema.refreshTokens.tokenHash, hash),
          eq(schema.refreshTokens.userId, payload.sub),
          gt(schema.refreshTokens.expiresAt, new Date()),
          isNull(schema.refreshTokens.revokedAt),
        ),
      )
      .limit(1)
    if (!stored) {
      clearAuthCookies(jar)
      return fail(401, '폐기된 리프레시 토큰입니다.')
    }

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, payload.sub)).limit(1)
    if (!user || user.bannedAt) {
      clearAuthCookies(jar)
      return fail(401, '사용자가 존재하지 않거나 비활성화됐습니다.')
    }

    // rotate: 기존 refresh revoke + 새 토큰 발급
    await revokeRefreshToken(refresh)
    const ua = (await headers()).get('user-agent') ?? undefined
    const tokens = await issueTokenPair(user.id, user.role, user.nickname, ua)
    setAuthCookies(jar, tokens)

    return ok({ user: { id: user.id, nickname: user.nickname, role: user.role } })
  })
}
