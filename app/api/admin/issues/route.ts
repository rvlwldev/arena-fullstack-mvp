import { desc } from 'drizzle-orm'
import { db, schema } from '@/app/_lib/db'
import { requireAdmin } from '@/app/_lib/auth/session'
import { issueCreateSchema } from '@/app/_lib/domain/issue'
import { validateIssueWindow, deriveIssueStatus } from '@/app/_lib/domain/issue-status'
import { handle, fail, created, ok } from '@/app/_lib/http'

export async function GET() {
  return handle(async () => {
    await requireAdmin()
    const rows = await db.select().from(schema.issues).orderBy(desc(schema.issues.createdAt))
    return ok({ issues: rows })
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin()
    const body = issueCreateSchema.parse(await req.json())
    const winErr = validateIssueWindow(body)
    if (winErr) return fail(400, winErr)
    const status = deriveIssueStatus(new Date(), body)
    const [row] = await db
      .insert(schema.issues)
      .values({ ...body, status })
      .returning()
    return created({ issue: row })
  })
}
