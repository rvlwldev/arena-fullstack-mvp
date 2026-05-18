import { z } from 'zod'
import { cookies, headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/app/_lib/db'
import { verifyPassword } from '@/app/_lib/auth/password'
import { issueTokenPair } from '@/app/_lib/auth/session'
import { setAuthCookies } from '@/app/_lib/auth/cookies'
import { handle, fail, ok } from '@/app/_lib/http'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: Request) {
  return handle(async () => {
    const body = loginSchema.parse(await req.json())

    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, body.email)).limit(1)
    if (!user || user.bannedAt) return fail(401, '이메일 또는 비밀번호가 올바르지 않습니다.')

    const passOk = await verifyPassword(user.passwordHash, body.password)
    if (!passOk) return fail(401, '이메일 또는 비밀번호가 올바르지 않습니다.')

    const ua = (await headers()).get('user-agent') ?? undefined
    const tokens = await issueTokenPair(user.id, user.role, user.nickname, ua)
    const jar = await cookies()
    setAuthCookies(jar, tokens)

    return ok({ user: { id: user.id, nickname: user.nickname, role: user.role } })
  })
}
