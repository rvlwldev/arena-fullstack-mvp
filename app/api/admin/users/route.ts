import { sql } from 'drizzle-orm'
import { db } from '@/app/_lib/db'
import { requireAdmin } from '@/app/_lib/auth/session'
import { handle, ok } from '@/app/_lib/http'

const PAGE_SIZE_DEFAULT = 20
const PAGE_SIZE_MAX = 50

/**
 * GET /api/admin/users?q=&page=1&size=20
 * 정렬: 활성 ban 보유자 먼저 (만료 임박 순), 그 다음 가입 최신 순
 * 한 쿼리로 사용자 + 활성 ban(expires_at, memo) 모두 조회 (LATERAL JOIN).
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
    const whereClause = search
      ? sql`(LOWER(u.email) LIKE ${search} OR LOWER(u.nickname) LIKE ${search})`
      : sql`TRUE`

    // count + rows를 분리하지만 두 쿼리는 병렬 처리
    const [countResult, listResult] = await Promise.all([
      db.execute(sql`SELECT COUNT(*)::int AS total FROM users u WHERE ${whereClause}`),
      db.execute(sql`
        SELECT
          u.id, u.email, u.nickname, u.role, u.created_at, u.banned_at,
          s.expires_at AS ban_expires_at,
          s.memo       AS ban_memo
        FROM users u
        LEFT JOIN LATERAL (
          SELECT expires_at, memo FROM sanctions
          WHERE user_id = u.id AND lifted_at IS NULL AND expires_at > NOW()
          ORDER BY expires_at DESC LIMIT 1
        ) s ON TRUE
        WHERE ${whereClause}
        ORDER BY (s.expires_at IS NOT NULL) DESC, s.expires_at ASC NULLS LAST, u.created_at DESC
        LIMIT ${size} OFFSET ${offset}
      `),
    ])

    const total = Number((countResult.rows[0] as { total: number })?.total ?? 0)

    const users = listResult.rows.map((row) => {
      const r = row as {
        id: string
        email: string
        nickname: string
        role: 'USER' | 'ADMIN'
        created_at: string | Date
        banned_at: string | Date | null
        ban_expires_at: string | Date | null
        ban_memo: string | null
      }
      return {
        id: r.id,
        email: r.email,
        nickname: r.nickname,
        role: r.role,
        createdAt: new Date(r.created_at),
        bannedAt: r.banned_at ? new Date(r.banned_at) : null,
        banExpiresAt: r.ban_expires_at ? new Date(r.ban_expires_at) : null,
        isBanned: Boolean(r.ban_expires_at),
        banMemo: r.ban_memo,
      }
    })

    return ok({
      users,
      page,
      size,
      total,
      totalPages: Math.max(1, Math.ceil(total / size)),
    })
  })
}
