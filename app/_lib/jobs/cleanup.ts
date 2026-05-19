import { and, eq, inArray, lte } from 'drizzle-orm'
import { db, schema } from '../db'

export const CLEANUP_GRACE_DAYS = 7

/**
 * status='ARCHIVED' AND result_at + 7일 <= now 인 이슈의 chat/comment/reply/reaction 삭제 후
 * status='CLEANED' 표시. reactions/replies는 cascade로 함께 정리됨.
 */
export async function runCleanup(now: Date = new Date()): Promise<{ cleaned: number }> {
  const cutoff = new Date(now.getTime() - CLEANUP_GRACE_DAYS * 24 * 60 * 60 * 1000)

  const targets = await db
    .select({ id: schema.issues.id })
    .from(schema.issues)
    .where(
      and(
        eq(schema.issues.status, 'ARCHIVED'),
        lte(schema.issues.resultAt, cutoff),
      ),
    )

  if (targets.length === 0) return { cleaned: 0 }
  const ids = targets.map((t) => t.id)

  // chats 명시 삭제 (issue → cascade 가능하지만 명시적으로)
  await db.delete(schema.chats).where(inArray(schema.chats.issueId, ids))
  // comments 삭제 시 replies/reactions는 cascade
  await db.delete(schema.comments).where(inArray(schema.comments.issueId, ids))

  await db
    .update(schema.issues)
    .set({ status: 'CLEANED' })
    .where(inArray(schema.issues.id, ids))

  return { cleaned: ids.length }
}
