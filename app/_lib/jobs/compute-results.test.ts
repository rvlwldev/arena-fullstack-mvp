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
  await db.delete(schema.reactions)
  await db.delete(schema.replies)
  await db.delete(schema.issueResults)
  await db.delete(schema.comments)
  await db.delete(schema.issues)
  await db.delete(schema.users)
  await pool.end()
})

beforeEach(async () => {
  await db.delete(schema.reactions)
  await db.delete(schema.replies)
  await db.delete(schema.issueResults)
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
      nickname: `u_${suffix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      passwordHash: hash,
    })
    .returning()
  return u
}

async function seedIssue(status: 'RESULT' | 'ACTIVE' = 'RESULT') {
  const [issue] = await db
    .insert(schema.issues)
    .values({
      title: 't',
      sideALabel: 'L', sideASummary: 's',
      sideBLabel: 'R', sideBSummary: 's',
      opensAt: new Date(Date.now() - 7200_000),
      closesAt: status === 'RESULT' ? new Date(Date.now() - 60_000) : new Date(Date.now() + 3600_000),
      resultAt: new Date(Date.now() + 7200_000),
      status,
    })
    .returning()
  return issue
}

describe('computeResultForIssue (DB)', () => {
  it('empathy + rebuttal + dopamine×5 공식으로 TOP3 + 승자 계산', async () => {
    const [u1, u2, u3, u4] = await Promise.all([
      seedUser('l1'),
      seedUser('l2'),
      seedUser('r1'),
      seedUser('voter'),
    ])
    const issue = await seedIssue('RESULT')

    const [cL1, cL2, cR1] = await db
      .insert(schema.comments)
      .values([
        { issueId: issue.id, userId: u1.id, side: 'left', body: 'L1' },
        { issueId: issue.id, userId: u2.id, side: 'left', body: 'L2' },
        { issueId: issue.id, userId: u3.id, side: 'right', body: 'R1' },
      ])
      .returning()

    // cL1: empathy 2 (u2, u3), dopamine 1 (u4) → 점수 2 + 0 + 1×5 = 7
    await db.insert(schema.reactions).values([
      { userId: u2.id, commentId: cL1.id, kind: 'empathy' },
      { userId: u3.id, commentId: cL1.id, kind: 'empathy' },
      { userId: u4.id, commentId: cL1.id, kind: 'dopamine' },
    ])
    // cL2: empathy 1 → 1
    await db.insert(schema.reactions).values({ userId: u3.id, commentId: cL2.id, kind: 'empathy' })
    // cR1: dopamine 2 (u1, u2) → 10
    await db.insert(schema.reactions).values([
      { userId: u1.id, commentId: cR1.id, kind: 'dopamine' },
      { userId: u2.id, commentId: cR1.id, kind: 'dopamine' },
    ])

    // cL1에 답글 2개 (서로 다른 유저) → rebuttal 2
    await db.insert(schema.replies).values([
      { commentId: cL1.id, userId: u2.id, side: 'right', body: '반박1' },
      { commentId: cL1.id, userId: u3.id, side: 'right', body: '반박2' },
    ])

    const { computeResultForIssue } = await import('./compute-results')
    await computeResultForIssue(issue.id)

    const [stored] = await db
      .select()
      .from(schema.issueResults)
      .where(eq(schema.issueResults.issueId, issue.id))
    expect(stored).toBeTruthy()
    const aTop = stored.sideATop3 as Array<{ commentId: string; score: number; empathy: number; dopamine: number; rebuttal: number }>
    const bTop = stored.sideBTop3 as Array<{ commentId: string; score: number; empathy: number; dopamine: number; rebuttal: number }>

    // cL1 점수 = 2 + 2 + 1×5 = 9
    const l1 = aTop.find((c) => c.commentId === cL1.id)
    expect(l1).toMatchObject({ empathy: 2, dopamine: 1, rebuttal: 2, score: 9 })
    // cL2 점수 = 1
    expect(aTop.find((c) => c.commentId === cL2.id)?.score).toBe(1)
    // cR1 점수 = 0 + 0 + 2×5 = 10
    expect(bTop[0]).toMatchObject({ commentId: cR1.id, score: 10 })
    // 좌 합 = 9 + 1 = 10, 우 합 = 10 → TIE
    expect(stored.winnerSide).toBe('TIE')
  })

  it('같은 유저가 같은 의견에 답글 여러 개 달아도 rebuttal은 1로 카운트', async () => {
    const [u1, u2] = await Promise.all([seedUser('a'), seedUser('b')])
    const issue = await seedIssue('RESULT')
    const [c] = await db
      .insert(schema.comments)
      .values({ issueId: issue.id, userId: u1.id, side: 'left', body: 'C' })
      .returning()
    await db.insert(schema.replies).values([
      { commentId: c.id, userId: u2.id, side: 'right', body: 'r1' },
      { commentId: c.id, userId: u2.id, side: 'right', body: 'r2' },
      { commentId: c.id, userId: u2.id, side: 'right', body: 'r3' },
    ])
    const { computeResultForIssue } = await import('./compute-results')
    await computeResultForIssue(issue.id)
    const [stored] = await db
      .select()
      .from(schema.issueResults)
      .where(eq(schema.issueResults.issueId, issue.id))
    const top = stored.sideATop3 as Array<{ rebuttal: number; score: number }>
    expect(top[0].rebuttal).toBe(1)
    expect(top[0].score).toBe(1)
  })

  it('답글의 답글(자식)은 rebuttal 카운트에서 제외 (parent_reply_id IS NULL만)', async () => {
    const [u1, u2, u3] = await Promise.all([seedUser('a'), seedUser('b'), seedUser('c')])
    const issue = await seedIssue('RESULT')
    const [c] = await db
      .insert(schema.comments)
      .values({ issueId: issue.id, userId: u1.id, side: 'left', body: 'C' })
      .returning()
    const [root] = await db
      .insert(schema.replies)
      .values({ commentId: c.id, userId: u2.id, side: 'right', body: 'root' })
      .returning()
    // u3가 답글의 답글 (자식)
    await db.insert(schema.replies).values({
      commentId: c.id,
      parentReplyId: root.id,
      userId: u3.id,
      side: 'right',
      body: '자식',
    })

    const { computeResultForIssue } = await import('./compute-results')
    await computeResultForIssue(issue.id)
    const [stored] = await db
      .select()
      .from(schema.issueResults)
      .where(eq(schema.issueResults.issueId, issue.id))
    const top = stored.sideATop3 as Array<{ rebuttal: number }>
    expect(top[0].rebuttal).toBe(1) // u2만 카운트
  })

  it('이미 결과가 있으면 skip (idempotent)', async () => {
    const u = await seedUser('idem')
    const issue = await seedIssue('RESULT')
    await db.insert(schema.comments).values({ issueId: issue.id, userId: u.id, side: 'left', body: 'X' })

    const { computeResultForIssue } = await import('./compute-results')
    await computeResultForIssue(issue.id)
    await computeResultForIssue(issue.id)

    const rows = await db
      .select()
      .from(schema.issueResults)
      .where(eq(schema.issueResults.issueId, issue.id))
    expect(rows).toHaveLength(1)
  })
})
