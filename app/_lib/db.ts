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
      // Railway Free Plan(1 vCPU/0.5GB) 환경에서 안정적인 풀 크기
      max: 5,
      // 짧은 idle 정리 + connection retry 단축
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      // statement 타임아웃 (각 쿼리는 10초 내 끝나야 함)
      statement_timeout: 10_000,
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
