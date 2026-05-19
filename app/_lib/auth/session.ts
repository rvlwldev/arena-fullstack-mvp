import { cookies } from 'next/headers'
import { createHash, randomUUID } from 'crypto'
import { and, desc, eq, gt, isNull } from 'drizzle-orm'
import { db, schema } from '../db'
import { env } from '../env'
import { signAccessToken, signRefreshToken, verifyAccessToken } from './jwt'
import { ACCESS_COOKIE } from './cookies'

export interface BanInfo {
  expiresAt: Date
  memo: string | null
  startsAt: Date
}

export interface CurrentUser {
  id: string
  role: 'USER' | 'ADMIN'
  nickname: string
}

export interface CurrentUserWithBan extends CurrentUser {
  ban: BanInfo | null
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies()
  const access = jar.get(ACCESS_COOKIE)?.value
  if (!access) return null
  const payload = await verifyAccessToken(access)
  if (!payload) return null
  return { id: payload.sub, role: payload.role, nickname: payload.nickname }
}

export async function getCurrentUserWithBan(): Promise<CurrentUserWithBan | null> {
  const user = await getCurrentUser()
  if (!user) return null
  const ban = await activeBan(user.id)
  return { ...user, ban }
}

/**
 * 로그인만 강제 (밴 상태여도 통과). banned 정보는 함께 반환.
 * mutation에서는 requireActiveUser()를 별도로 사용해야 함.
 */
export async function requireUser(): Promise<CurrentUserWithBan> {
  const user = await getCurrentUserWithBan()
  if (!user) throw new HttpError(401, '로그인이 필요합니다.')
  // 영구 비활성화(bannedAt)는 즉시 차단
  const [u] = await db
    .select({ bannedAt: schema.users.bannedAt })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1)
  if (!u) throw new HttpError(401, '사용자가 존재하지 않습니다.')
  if (u.bannedAt) throw new HttpError(403, '영구 비활성화된 계정입니다.')
  return user
}

/**
 * mutation용: banned면 403 (밴 만료 시각 + 사유 메시지)
 */
export async function requireActiveUser(): Promise<CurrentUser> {
  const user = await requireUser()
  if (user.ban) {
    const memo = user.ban.memo ? ` / 사유: ${user.ban.memo}` : ''
    throw new HttpError(
      403,
      `이용 정지 중입니다. 해제 시각: ${user.ban.expiresAt.toISOString()}${memo}`,
    )
  }
  return { id: user.id, role: user.role, nickname: user.nickname }
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser()
  if (user.role !== 'ADMIN') throw new HttpError(403, '관리자 권한이 필요합니다.')
  return { id: user.id, role: user.role, nickname: user.nickname }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export async function activeBan(userId: string): Promise<BanInfo | null> {
  const now = new Date()
  const [row] = await db
    .select({
      startsAt: schema.sanctions.startsAt,
      expiresAt: schema.sanctions.expiresAt,
      memo: schema.sanctions.memo,
    })
    .from(schema.sanctions)
    .where(
      and(
        eq(schema.sanctions.userId, userId),
        gt(schema.sanctions.expiresAt, now),
        isNull(schema.sanctions.liftedAt),
      ),
    )
    .orderBy(desc(schema.sanctions.expiresAt))
    .limit(1)
  if (!row) return null
  return { startsAt: row.startsAt, expiresAt: row.expiresAt, memo: row.memo }
}

export async function activeBansByUserIds(userIds: string[]): Promise<Map<string, BanInfo>> {
  const map = new Map<string, BanInfo>()
  if (userIds.length === 0) return map
  const now = new Date()
  const rows = await db
    .select({
      userId: schema.sanctions.userId,
      startsAt: schema.sanctions.startsAt,
      expiresAt: schema.sanctions.expiresAt,
      memo: schema.sanctions.memo,
    })
    .from(schema.sanctions)
    .where(
      and(
        gt(schema.sanctions.expiresAt, now),
        isNull(schema.sanctions.liftedAt),
      ),
    )
  for (const r of rows) {
    if (!userIds.includes(r.userId)) continue
    const existing = map.get(r.userId)
    if (!existing || existing.expiresAt < r.expiresAt) {
      map.set(r.userId, { startsAt: r.startsAt, expiresAt: r.expiresAt, memo: r.memo })
    }
  }
  return map
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
