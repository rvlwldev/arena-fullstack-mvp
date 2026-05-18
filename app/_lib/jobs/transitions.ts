import { and, gt, inArray, lte, eq } from 'drizzle-orm'
import { db, schema } from '../db'

/**
 * 시간 기준으로 status를 일괄 전이한다.
 * 동일 row가 여러 단계 점프해야 할 수도 있으므로 ARCHIVED 우선 처리 후 RESULT, ACTIVE 순서.
 * idempotent — 이미 목표 상태인 row는 조건에서 제외.
 * CLEANED는 정리 잡이 별도로 표시한다.
 */
export async function runStatusTransitions(now: Date = new Date()): Promise<{
  toActive: number
  toResult: number
  toArchived: number
}> {
  const toArchived = await db
    .update(schema.issues)
    .set({ status: 'ARCHIVED' })
    .where(
      and(
        lte(schema.issues.resultAt, now),
        inArray(schema.issues.status, ['DRAFT', 'ACTIVE', 'RESULT']),
      ),
    )
    .returning({ id: schema.issues.id })

  const toResult = await db
    .update(schema.issues)
    .set({ status: 'RESULT' })
    .where(
      and(
        lte(schema.issues.closesAt, now),
        gt(schema.issues.resultAt, now),
        inArray(schema.issues.status, ['DRAFT', 'ACTIVE']),
      ),
    )
    .returning({ id: schema.issues.id })

  const toActive = await db
    .update(schema.issues)
    .set({ status: 'ACTIVE' })
    .where(
      and(
        lte(schema.issues.opensAt, now),
        gt(schema.issues.closesAt, now),
        eq(schema.issues.status, 'DRAFT'),
      ),
    )
    .returning({ id: schema.issues.id })

  return {
    toActive: toActive.length,
    toResult: toResult.length,
    toArchived: toArchived.length,
  }
}
