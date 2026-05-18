import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '@/drizzle/schema'
import { env } from './env'

declare global {
  var __pgPool: Pool | undefined
}

const pool =
  globalThis.__pgPool ??
  new Pool({
    connectionString: env().DATABASE_URL,
    max: 8,
    idleTimeoutMillis: 30_000,
  })

if (env().NODE_ENV !== 'production') {
  globalThis.__pgPool = pool
}

export const db = drizzle(pool, { schema })
export { schema }
