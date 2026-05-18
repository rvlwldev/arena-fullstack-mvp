import { eq } from 'drizzle-orm'
import { db, schema } from '@/app/_lib/db'
import { handle, fail, ok } from '@/app/_lib/http'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params
    const [result] = await db
      .select()
      .from(schema.issueResults)
      .where(eq(schema.issueResults.issueId, id))
      .limit(1)
    if (!result) return fail(404, '결과가 아직 계산되지 않았습니다.')
    return ok({ result })
  })
}
