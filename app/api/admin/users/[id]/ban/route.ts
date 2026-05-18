import { z } from 'zod'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { db, schema } from '@/app/_lib/db'
import { requireAdmin, revokeAllRefreshTokensForUser } from '@/app/_lib/auth/session'
import { handle, fail, noContent, ok } from '@/app/_lib/http'

const banSchema = z.object({
  expiresAt: z.coerce.date(),
  memo: z.string().max(500).optional(),
})

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin()
    const { id } = await ctx.params
    const body = banSchema.parse(await req.json())
    if (body.expiresAt <= new Date()) return fail(400, '만료 시각은 현재보다 미래여야 합니다.')

    const [target] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1)
    if (!target) return fail(404, '사용자를 찾을 수 없습니다.')
    if (target.role === 'ADMIN') return fail(403, '관리자는 밴할 수 없습니다.')

    const [row] = await db
      .insert(schema.sanctions)
      .values({
        userId: id,
        type: 'BAN',
        expiresAt: body.expiresAt,
        memo: body.memo ?? null,
        byAdminId: admin.id,
      })
      .returning()

    await revokeAllRefreshTokensForUser(id)
    return ok({ sanction: row })
  })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireAdmin()
    const { id } = await ctx.params
    await db
      .update(schema.sanctions)
      .set({ liftedAt: new Date() })
      .where(
        and(
          eq(schema.sanctions.userId, id),
          gt(schema.sanctions.expiresAt, new Date()),
          isNull(schema.sanctions.liftedAt),
        ),
      )
    return noContent()
  })
}
