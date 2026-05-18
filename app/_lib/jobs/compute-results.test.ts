import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv({ path: '.env' })

import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'
import argon2 from 'argon2'
import * as schema from '@/drizzle/schema'

let pool: Pool
let db: ReturnType<typeof drizzle<typeof schema>>

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  db = drizzle(pool, { schema })
})

afterAll(async () => {
  await db.delete(schema.issueResults)
  await db.delete(schema.votes)
  await db.delete(schema.comments)
  await db.delete(schema.issues)
  await db.delete(schema.users)
  await pool.end()
})

beforeEach(async () => {
  await db.delete(schema.issueResults)
  await db.delete(schema.votes)
  await db.delete(schema.comments)
  await db.delete(schema.issues)
  await db.delete(schema.users)
})

async function seedUser(suffix: string) {
  const hash = await argon2.hash('pw12345678')
  const [u] = await db
    .insert(schema.users)
    .values({
      email: `${suffix}@test.local`,
      nickname: `u_${suffix}_${Date.now()}`,
      passwordHash: hash,
    })
    .returning()
  return u
}

describe('computeResultForIssue (DB)', () => {
  it('각 진영 TOP3와 승자를 IssueResult에 저장', async () => {
    const [u1, u2, u3, u4] = await Promise.all([
      seedUser('a1'),
      seedUser('a2'),
      seedUser('b1'),
      seedUser('voter'),
    ])

    const [issue] = await db
      .insert(schema.issues)
      .values({
        title: 't',
        sideALabel: 'A', sideASummary: 's',
        sideBLabel: 'B', sideBSummary: 's',
        opensAt: new Date(Date.now() - 7200_000),
        closesAt: new Date(Date.now() - 60_000),
        resultAt: new Date(Date.now() + 60_000),
        status: 'RESULT',
      })
      .returning()

    const [a1, a2, b1] = await db
      .insert(schema.comments)
      .values([
        { issueId: issue.id, userId: u1.id, side: 'A', body: 'A1' },
        { issueId: issue.id, userId: u2.id, side: 'A', body: 'A2' },
        { issueId: issue.id, userId: u3.id, side: 'B', body: 'B1' },
      ])
      .returning()

    await db.insert(schema.votes).values([
      { commentId: a1.id, userId: u2.id, value: 1 },
      { commentId: a1.id, userId: u3.id, value: 1 },
      { commentId: a2.id, userId: u1.id, value: -1 },
      { commentId: b1.id, userId: u4.id, value: 1 },
    ])

    const { computeResultForIssue } = await import('./compute-results')
    await computeResultForIssue(issue.id)

    const [stored] = await db
      .select()
      .from(schema.issueResults)
      .where(eq(schema.issueResults.issueId, issue.id))
    expect(stored).toBeTruthy()
    const aTop = stored.sideATop3 as Array<{ commentId: string; score: number }>
    const bTop = stored.sideBTop3 as Array<{ commentId: string; score: number }>
    expect(aTop[0].commentId).toBe(a1.id)
    expect(aTop[0].score).toBe(2)
    expect(bTop[0].commentId).toBe(b1.id)
    expect(bTop[0].score).toBe(1)
    // A 합 = 2 + (-1) = 1, B 합 = 1 → TIE
    expect(stored.winnerSide).toBe('TIE')
  })

  it('이미 결과가 있으면 skip (onConflictDoNothing)', async () => {
    const u1 = await seedUser('idem')

    const [issue] = await db
      .insert(schema.issues)
      .values({
        title: 't',
        sideALabel: 'A', sideASummary: 's',
        sideBLabel: 'B', sideBSummary: 's',
        opensAt: new Date(Date.now() - 7200_000),
        closesAt: new Date(Date.now() - 60_000),
        resultAt: new Date(Date.now() + 60_000),
        status: 'RESULT',
      })
      .returning()

    await db.insert(schema.comments).values({ issueId: issue.id, userId: u1.id, side: 'A', body: 'A' })

    const { computeResultForIssue } = await import('./compute-results')
    await computeResultForIssue(issue.id)
    await computeResultForIssue(issue.id)

    const rows = await db.select().from(schema.issueResults).where(eq(schema.issueResults.issueId, issue.id))
    expect(rows).toHaveLength(1)
  })
})
