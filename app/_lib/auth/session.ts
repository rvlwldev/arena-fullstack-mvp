import { cookies } from 'next/headers'
import { createHash, randomUUID } from 'crypto'
import { and, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm'
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
 * users.banned_at + 최신 active sanction을 한 쿼리로 조회.
 */
export async function requireUser(): Promise<CurrentUserWithBan> {
  const base = await getCurrentUser()
  if (!base) throw new HttpError(401, '로그인이 필요합니다.')
  const now = new Date()
  const result = await db.execute(sql`
    SELECT
      u.banned_at,
      s.starts_at  AS s_starts_at,
      s.expires_at AS s_expires_at,
      s.memo       AS s_memo
    FROM users u
    LEFT JOIN LATERAL (
      SELECT starts_at, expires_at, memo FROM sanctions
      WHERE user_id = u.id AND lifted_at IS NULL AND expires_at > ${now}
      ORDER BY expires_at DESC LIMIT 1
    ) s ON TRUE
    WHERE u.id = ${base.id}
    LIMIT 1
  `)
  const row = result.rows[0] as
    | {
        banned_at: string | Date | null
        s_starts_at: string | Date | null
        s_expires_at: string | Date | null
        s_memo: string | null
      }
    | undefined
  if (!row) throw new HttpError(401, '사용자가 존재하지 않습니다.')
  if (row.banned_at) throw new HttpError(403, '영구 비활성화된 계정입니다.')
  const ban: BanInfo | null = row.s_expires_at
    ? {
        startsAt: new Date(row.s_starts_at as string | Date),
        expiresAt: new Date(row.s_expires_at as string | Date),
        memo: row.s_memo,
      }
    : null
  return { ...base, ban }
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
  // DB에서 직접 좁히고 user별 최대 expires_at만 가져옴 (DISTINCT ON)
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
        inArray(schema.sanctions.userId, userIds),
        gt(schema.sanctions.expiresAt, now),
        isNull(schema.sanctions.liftedAt),
      ),
    )
    .orderBy(desc(schema.sanctions.expiresAt))
  for (const r of rows) {
    if (!map.has(r.userId)) {
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
