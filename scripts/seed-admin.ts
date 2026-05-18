import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv({ path: '.env' })

import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'
import argon2 from 'argon2'
import * as schema from '../drizzle/schema'

async function main() {
  const url = process.env.DATABASE_URL
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_INITIAL_PASSWORD
  const nickname = process.env.ADMIN_NICKNAME ?? 'admin'

  if (!url) throw new Error('DATABASE_URL이 없습니다.')
  if (!email || !password) throw new Error('ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD가 없습니다.')

  const pool = new Pool({ connectionString: url, max: 1 })
  const db = drizzle(pool, { schema })

  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1)
  if (existing) {
    if (existing.role !== 'ADMIN') {
      await db.update(schema.users).set({ role: 'ADMIN' }).where(eq(schema.users.id, existing.id))
      console.log(`기존 사용자 ${email}의 권한을 ADMIN으로 승격했습니다.`)
    } else {
      console.log(`관리자 ${email}가 이미 존재합니다. skip.`)
    }
    await pool.end()
    return
  }

  const hash = await argon2.hash(password, { type: argon2.argon2id })
  await db.insert(schema.users).values({
    email,
    nickname,
    passwordHash: hash,
    role: 'ADMIN',
  })
  console.log(`관리자 계정 생성 완료: ${email} (nickname=${nickname})`)
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
