import { cookies } from 'next/headers'
import { createHash, randomUUID } from 'crypto'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { db, schema } from '../db'
import { env } from '../env'
import { signAccessToken, signRefreshToken, verifyAccessToken } from './jwt'
import { ACCESS_COOKIE } from './cookies'

export interface CurrentUser {
  id: string
  role: 'USER' | 'ADMIN'
  nickname: string
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies()
  const access = jar.get(ACCESS_COOKIE)?.value
  if (!access) return null
  const payload = await verifyAccessToken(access)
  if (!payload) return null
  return { id: payload.sub, role: payload.role, nickname: payload.nickname }
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) throw new HttpError(401, '로그인이 필요합니다.')
  await ensureNotBanned(user.id)
  return user
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser()
  if (user.role !== 'ADMIN') throw new HttpError(403, '관리자 권한이 필요합니다.')
  return user
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function ensureNotBanned(userId: string) {
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1)
  if (!u) throw new HttpError(401, '사용자가 존재하지 않습니다.')
  if (u.bannedAt) throw new HttpError(403, '영구 비활성화된 계정입니다.')
  const now = new Date()
  const [active] = await db
    .select()
    .from(schema.sanctions)
    .where(
      and(
        eq(schema.sanctions.userId, userId),
        gt(schema.sanctions.expiresAt, now),
        isNull(schema.sanctions.liftedAt),
      ),
    )
    .limit(1)
  if (active) {
    throw new HttpError(
      403,
      `이용 정지 중입니다. 해제 시각: ${active.expiresAt.toISOString()}${active.memo ? ` / 사유: ${active.memo}` : ''}`,
    )
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function issueTokenPair(
  userId: string,
  role: 'USER' | 'ADMIN',
  nickname: string,
  userAgent?: string,
): Promise<{ access: string; refresh: string }> {
  const jti = randomUUID()
  const access = await signAccessToken({ sub: userId, role, nickname })
  const refresh = await signRefreshToken({ sub: userId, jti })
  await db.insert(schema.refreshTokens).values({
    userId,
    tokenHash: hashToken(refresh),
    expiresAt: new Date(Date.now() + env().REFRESH_TOKEN_TTL * 1000),
    userAgent: userAgent ?? null,
  })
  return { access, refresh }
}

export async function revokeRefreshToken(refreshTokenValue: string) {
  const tokenHash = hashToken(refreshTokenValue)
  await db
    .update(schema.refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.refreshTokens.tokenHash, tokenHash), isNull(schema.refreshTokens.revokedAt)))
}

export async function revokeAllRefreshTokensForUser(userId: string) {
  await db
    .update(schema.refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.refreshTokens.userId, userId), isNull(schema.refreshTokens.revokedAt)))
}

export function refreshTokenHash(token: string): string {
  return hashToken(token)
}
