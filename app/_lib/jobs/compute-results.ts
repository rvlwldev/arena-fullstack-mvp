import { eq, inArray, notInArray, sql } from 'drizzle-orm'
import { db, schema } from '../db'
import { computeResult, type CommentVotes } from '../domain/score'

/**
 * RESULT 상태인 이슈 중 아직 IssueResult가 없는 것을 계산하여 저장.
 * idempotent — 이미 결과가 있으면 skip.
 */
export async function computeMissingResults(): Promise<{ computed: number }> {
  const existing = await db.select({ id: schema.issueResults.issueId }).from(schema.issueResults)
  const existingIds = existing.map((r) => r.id)

  const targets = await db
    .select({ id: schema.issues.id })
    .from(schema.issues)
    .where(
      existingIds.length > 0
        ? sql`${schema.issues.status} = 'RESULT' AND ${schema.issues.id} NOT IN ${existingIds}`
        : eq(schema.issues.status, 'RESULT'),
    )

  let computed = 0
  for (const t of targets) {
    await computeResultForIssue(t.id)
    computed++
  }
  return { computed }
}

export async function computeResultForIssue(issueId: string) {
  const rows = await db
    .select({
      commentId: schema.comments.id,
      side: schema.comments.side,
      createdAt: schema.comments.createdAt,
      likes: sql<number>`COUNT(*) FILTER (WHERE ${schema.votes.value} = 1)::int`,
      dislikes: sql<number>`COUNT(*) FILTER (WHERE ${schema.votes.value} = -1)::int`,
    })
    .from(schema.comments)
    .leftJoin(schema.votes, eq(schema.votes.commentId, schema.comments.id))
    .where(sql`${schema.comments.issueId} = ${issueId} AND ${schema.comments.deletedAt} IS NULL`)
    .groupBy(schema.comments.id, schema.comments.side, schema.comments.createdAt)

  const cv: CommentVotes[] = rows.map((r) => ({
    commentId: r.commentId,
    side: r.side as 'A' | 'B',
    likes: Number(r.likes),
    dislikes: Number(r.dislikes),
    createdAt: r.createdAt,
  }))

  const snap = computeResult(cv)
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
