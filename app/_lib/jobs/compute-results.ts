import { and, eq, isNull, sql } from 'drizzle-orm'
import { db, schema } from '../db'
import { computeResult, type CommentReactions } from '../domain/score'

/**
 * RESULT 상태인 이슈 중 아직 IssueResult가 없는 것을 계산하여 저장.
 * idempotent — 이미 결과가 있으면 skip.
 */
export async function computeMissingResults(): Promise<{ computed: number }> {
  const existing = await db.select({ id: schema.issueResults.issueId }).from(schema.issueResults)
  const existingIds = new Set(existing.map((r) => r.id))

  const targets = await db
    .select({ id: schema.issues.id })
    .from(schema.issues)
    .where(eq(schema.issues.status, 'RESULT'))

  let computed = 0
  for (const t of targets) {
    if (existingIds.has(t.id)) continue
    await computeResultForIssue(t.id)
    computed++
  }
  return { computed }
}

export async function computeResultForIssue(issueId: string) {
  const rows = await aggregateCommentReactions(issueId)
  const snap = computeResult(rows)
  await db
    .insert(schema.issueResults)
    .values({
      issueId,
      winnerSide: snap.winnerSide,
      sideATop3: snap.sideATop3,
      sideBTop3: snap.sideBTop3,
    })
    .onConflictDoNothing({ target: schema.issueResults.issueId })
}

/**
 * 이슈 내 의견 단위 집계:
 *   empathy = reactions WHERE comment_id = c.id AND kind='empathy'
 *   dopamine = reactions WHERE comment_id = c.id AND kind='dopamine'
 *   rebuttal = unique user_id of replies WHERE comment_id = c.id AND parent_reply_id IS NULL AND deleted_at IS NULL
 */
export async function aggregateCommentReactions(issueId: string): Promise<CommentReactions[]> {
  const empathySql = sql<number>`(
    SELECT COUNT(*)::int FROM ${schema.reactions} r
    WHERE r.comment_id = ${schema.comments.id} AND r.kind = 'empathy'
  )`
  const dopamineSql = sql<number>`(
    SELECT COUNT(*)::int FROM ${schema.reactions} r
    WHERE r.comment_id = ${schema.comments.id} AND r.kind = 'dopamine'
  )`
  const rebuttalSql = sql<number>`(
    SELECT COUNT(DISTINCT rp.user_id)::int FROM ${schema.replies} rp
    WHERE rp.comment_id = ${schema.comments.id}
      AND rp.parent_reply_id IS NULL
      AND rp.deleted_at IS NULL
  )`

  const rows = await db
    .select({
      commentId: schema.comments.id,
      side: schema.comments.side,
      createdAt: schema.comments.createdAt,
      empathy: empathySql,
      dopamine: dopamineSql,
      rebuttal: rebuttalSql,
    })
    .from(schema.comments)
    .where(and(eq(schema.comments.issueId, issueId), isNull(schema.comments.deletedAt)))

  return rows.map((r) => ({
    commentId: r.commentId,
    side: r.side as 'left' | 'right',
    createdAt: r.createdAt,
    empathy: Number(r.empathy),
    dopamine: Number(r.dopamine),
    rebuttal: Number(r.rebuttal),
  }))
}
