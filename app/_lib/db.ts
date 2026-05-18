import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '@/drizzle/schema'
import { env } from './env'

declare global {
  var __pgPool: Pool | undefined
  var __db: NodePgDatabase<typeof schema> | undefined
}

function getPool(): Pool {
  if (!globalThis.__pgPool) {
    globalThis.__pgPool = new Pool({
      connectionString: env().DATABASE_URL,
      max: 8,
      idleTimeoutMillis: 30_000,
    })
  }
  return globalThis.__pgPool
}

function getDb(): NodePgDatabase<typeof schema> {
  if (!globalThis.__db) {
    globalThis.__db = drizzle(getPool(), { schema })
  }
  return globalThis.__db
}

export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver)
  },
})
export { schema }
