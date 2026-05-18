import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv({ path: '.env' })

import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL이 설정되지 않았습니다.')
  }
  const pool = new Pool({ connectionString: url, max: 1 })
  const db = drizzle(pool)

  console.log('마이그레이션 시작...')
  await migrate(db, { migrationsFolder: './drizzle/migrations' })
  console.log('마이그레이션 완료.')
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
