import { z } from 'zod'
import { cookies, headers } from 'next/headers'
import { db, schema } from '@/app/_lib/db'
import { hashPassword } from '@/app/_lib/auth/password'
import { issueTokenPair } from '@/app/_lib/auth/session'
import { setAuthCookies } from '@/app/_lib/auth/cookies'
import { created, handle, fail } from '@/app/_lib/http'
import { eq, or } from 'drizzle-orm'

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  nickname: z.string().min(2).max(20).regex(/^[\w가-힣\-]+$/, '닉네임은 한글/영문/숫자/_/- 만 가능합니다.'),
})

export async function POST(req: Request) {
  return handle(async () => {
    const body = signupSchema.parse(await req.json())

    const [dup] = await db
      .select({ id: schema.users.id, email: schema.users.email, nickname: schema.users.nickname })
      .from(schema.users)
      .where(or(eq(schema.users.email, body.email), eq(schema.users.nickname, body.nickname)))
      .limit(1)
    if (dup) {
      if (dup.email === body.email) return fail(409, '이미 사용 중인 이메일입니다.')
      return fail(409, '이미 사용 중인 닉네임입니다.')
    }

    const passwordHash = await hashPassword(body.password)
    const [user] = await db
      .insert(schema.users)
      .values({ email: body.email, nickname: body.nickname, passwordHash })
      .returning({ id: schema.users.id, role: schema.users.role, nickname: schema.users.nickname })

    const ua = (await headers()).get('user-agent') ?? undefined
    const tokens = await issueTokenPair(user.id, user.role, user.nickname, ua)
    const jar = await cookies()
    setAuthCookies(jar, tokens)

    return created({
      user: { id: user.id, nickname: user.nickname, role: user.role },
    })
  })
}
