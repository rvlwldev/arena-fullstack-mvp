import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv({ path: '.env' })

import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'
import * as schema from '@/drizzle/schema'

let pool: Pool
let db: ReturnType<typeof drizzle<typeof schema>>

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  db = drizzle(pool, { schema })
})

afterAll(async () => {
  await db.delete(schema.issues)
  await pool.end()
})

beforeEach(async () => {
  await db.delete(schema.issues)
})

describe('runStatusTransitions (DB)', () => {
  it('opens_at 도달 시 DRAFT → ACTIVE', async () => {
    const past = new Date(Date.now() - 60_000)
    const future = new Date(Date.now() + 3600_000)
    const farFuture = new Date(Date.now() + 7200_000)
    const [issue] = await db
      .insert(schema.issues)
      .values({
        title: 't', sideALabel: 'a', sideASummary: 's', sideBLabel: 'b', sideBSummary: 's',
        opensAt: past, closesAt: future, resultAt: farFuture, status: 'DRAFT',
      })
      .returning()

    const { runStatusTransitions } = await import('./transitions')
    const r = await runStatusTransitions()
    expect(r.toActive).toBe(1)
    const [after] = await db.select().from(schema.issues).where(eq(schema.issues.id, issue.id))
    expect(after.status).toBe('ACTIVE')
  })

  it('closes_at 도달 시 ACTIVE → RESULT', async () => {
    const past = new Date(Date.now() - 7200_000)
    const past2 = new Date(Date.now() - 60_000)
    const future = new Date(Date.now() + 3600_000)
    const [issue] = await db
      .insert(schema.issues)
      .values({
        title: 't', sideALabel: 'a', sideASummary: 's', sideBLabel: 'b', sideBSummary: 's',
        opensAt: past, closesAt: past2, resultAt: future, status: 'ACTIVE',
      })
      .returning()

    const { runStatusTransitions } = await import('./transitions')
    await runStatusTransitions()
    const [after] = await db.select().from(schema.issues).where(eq(schema.issues.id, issue.id))
    expect(after.status).toBe('RESULT')
  })

  it('result_at 도달 시 → ARCHIVED', async () => {
    const past = new Date(Date.now() - 7200_000)
    const past2 = new Date(Date.now() - 3600_000)
    const past3 = new Date(Date.now() - 60_000)
    const [issue] = await db
      .insert(schema.issues)
      .values({
        title: 't', sideALabel: 'a', sideASummary: 's', sideBLabel: 'b', sideBSummary: 's',
        opensAt: past, closesAt: past2, resultAt: past3, status: 'RESULT',
      })
      .returning()

    const { runStatusTransitions } = await import('./transitions')
    await runStatusTransitions()
    const [after] = await db.select().from(schema.issues).where(eq(schema.issues.id, issue.id))
    expect(after.status).toBe('ARCHIVED')
  })

  it('CLEANED는 다시 ARCHIVED로 되돌리지 않음', async () => {
    const past = new Date(Date.now() - 7200_000)
    const [issue] = await db
      .insert(schema.issues)
      .values({
        title: 't', sideALabel: 'a', sideASummary: 's', sideBLabel: 'b', sideBSummary: 's',
        opensAt: past, closesAt: past, resultAt: past, status: 'CLEANED',
      })
      .returning()

    const { runStatusTransitions } = await import('./transitions')
    await runStatusTransitions()
    const [after] = await db.select().from(schema.issues).where(eq(schema.issues.id, issue.id))
    expect(after.status).toBe('CLEANED')
  })

  it('두번 연속 실행해도 동일 결과 (idempotent)', async () => {
    const past = new Date(Date.now() - 60_000)
    const future = new Date(Date.now() + 3600_000)
    const farFuture = new Date(Date.now() + 7200_000)
    await db.insert(schema.issues).values({
      title: 't', sideALabel: 'a', sideASummary: 's', sideBLabel: 'b', sideBSummary: 's',
      opensAt: past, closesAt: future, resultAt: farFuture, status: 'DRAFT',
    })
    const { runStatusTransitions } = await import('./transitions')
    await runStatusTransitions()
    const r2 = await runStatusTransitions()
    expect(r2.toActive).toBe(0)
  })
})
