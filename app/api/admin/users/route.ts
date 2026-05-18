import { desc, ilike, or } from 'drizzle-orm'
import { db, schema } from '@/app/_lib/db'
import { requireAdmin } from '@/app/_lib/auth/session'
import { handle, ok } from '@/app/_lib/http'

export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin()
    const url = new URL(req.url)
    const q = url.searchParams.get('q')

    const rows = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        nickname: schema.users.nickname,
        role: schema.users.role,
        createdAt: schema.users.createdAt,
        bannedAt: schema.users.bannedAt,
      })
      .from(schema.users)
      .where(q ? or(ilike(schema.users.email, `%${q}%`), ilike(schema.users.nickname, `%${q}%`)) : undefined)
      .orderBy(desc(schema.users.createdAt))
      .limit(100)

    return ok({ users: rows })
  })
}
