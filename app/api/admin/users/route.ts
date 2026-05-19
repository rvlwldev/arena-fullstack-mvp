import { sql } from 'drizzle-orm'
import { db, schema } from '@/app/_lib/db'
import { requireAdmin, activeBansByUserIds } from '@/app/_lib/auth/session'
import { handle, ok } from '@/app/_lib/http'

const PAGE_SIZE_DEFAULT = 20
const PAGE_SIZE_MAX = 50

/**
 * GET /api/admin/users?q=&page=1&size=20
 * 정렬: 활성 ban 보유자 먼저 (만료 임박 순), 그 다음 가입 최신 순
 */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin()
    const url = new URL(req.url)
    const q = (url.searchParams.get('q') ?? '').trim()
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
    const size = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(url.searchParams.get('size') ?? PAGE_SIZE_DEFAULT)))
    const offset = (page - 1) * size

    const search = q ? `%${q.toLowerCase()}%` : null

    const countResult = await db.execute(sql`
      SELECT COUNT(*)::int AS total FROM users u
      WHERE ${search ? sql`(LOWER(u.email) LIKE ${search} OR LOWER(u.nickname) LIKE ${search})` : sql`TRUE`}
    `)
    const total = Number((countResult.rows[0] as { total: number })?.total ?? 0)

    const result = await db.execute(sql`
      SELECT
        u.id, u.email, u.nickname, u.role, u.created_at, u.banned_at,
        (
          SELECT MAX(s.expires_at) FROM sanctions s
          WHERE s.user_id = u.id AND s.lifted_at IS NULL AND s.expires_at > NOW()
        ) AS ban_expires_at,
        EXISTS (
          SELECT 1 FROM sanctions s
          WHERE s.user_id = u.id AND s.lifted_at IS NULL AND s.expires_at > NOW()
        ) AS is_banned
      FROM users u
      WHERE ${search ? sql`(LOWER(u.email) LIKE ${search} OR LOWER(u.nickname) LIKE ${search})` : sql`TRUE`}
      ORDER BY is_banned DESC, ban_expires_at ASC NULLS LAST, u.created_at DESC
      LIMIT ${size} OFFSET ${offset}
    `)

    const users = result.rows.map((row) => {
      const r = row as {
        id: string
        email: string
        nickname: string
        role: 'USER' | 'ADMIN'
        created_at: string | Date
        banned_at: string | Date | null
        ban_expires_at: string | Date | null
        is_banned: boolean
      }
      return {
        id: r.id,
        email: r.email,
        nickname: r.nickname,
        role: r.role,
        createdAt: new Date(r.created_at),
        bannedAt: r.banned_at ? new Date(r.banned_at) : null,
        banExpiresAt: r.ban_expires_at ? new Date(r.ban_expires_at) : null,
        isBanned: Boolean(r.is_banned),
      }
    })

    // ban memo는 별도 호출로 채움 (간단)
    const userIds = users.filter((u) => u.isBanned).map((u) => u.id)
    const bans = await activeBansByUserIds(userIds)

    const enriched = users.map((u) => ({
      ...u,
      banMemo: bans.get(u.id)?.memo ?? null,
    }))

    return ok({
      users: enriched,
      page,
      size,
      total,
      totalPages: Math.max(1, Math.ceil(total / size)),
    })
  })
}
