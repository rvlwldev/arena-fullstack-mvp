import { eq } from 'drizzle-orm'
import { db, schema } from '@/app/_lib/db'
import { requireAdmin } from '@/app/_lib/auth/session'
import { issueUpdateSchema } from '@/app/_lib/domain/issue'
import { deriveIssueStatus, validateIssueWindow } from '@/app/_lib/domain/issue-status'
import { handle, fail, noContent, ok } from '@/app/_lib/http'

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireAdmin()
    const { id } = await ctx.params
    const body = issueUpdateSchema.parse(await req.json())

    const [current] = await db.select().from(schema.issues).where(eq(schema.issues.id, id)).limit(1)
    if (!current) return fail(404, '이슈를 찾을 수 없습니다.')

    const merged = {
      opensAt: body.opensAt ?? current.opensAt,
      closesAt: body.closesAt ?? current.closesAt,
      resultAt: body.resultAt ?? current.resultAt,
    }
    const winErr = validateIssueWindow(merged)
    if (winErr) return fail(400, winErr)

    const nextStatus = deriveIssueStatus(new Date(), merged)

    const [row] = await db
      .update(schema.issues)
      .set({ ...body, status: nextStatus })
      .where(eq(schema.issues.id, id))
      .returning()
    return ok({ issue: row })
  })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireAdmin()
    const { id } = await ctx.params
    const res = await db.delete(schema.issues).where(eq(schema.issues.id, id))
    if (res.rowCount === 0) return fail(404, '이슈를 찾을 수 없습니다.')
    return noContent()
  })
}
