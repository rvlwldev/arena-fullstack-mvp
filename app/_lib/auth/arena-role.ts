import { and, eq, isNull } from 'drizzle-orm'
import { db, schema } from '../db'
import type { ArenaRole } from '../domain/reaction'

/**
 * 이슈 안에서 사용자의 진영을 추론한다.
 *  1) 이미 의견(comment)이 있다면 그 side를 진영으로 확정
 *  2) 없으면 hintRole 사용 (클라이언트가 보낸 'left'|'right'|'spectator')
 *  3) hint도 없으면 'spectator'로 처리 (안전한 기본값)
 *
 * 이슈에 의견이 있는 사용자는 spectator로 다시 갈 수 없다 (확정 진영).
 */
export async function resolveArenaRole(
  userId: string,
  issueId: string,
  hint?: ArenaRole | null,
): Promise<ArenaRole> {
  const [row] = await db
    .select({ side: schema.comments.side })
    .from(schema.comments)
    .where(
      and(
        eq(schema.comments.userId, userId),
        eq(schema.comments.issueId, issueId),
        isNull(schema.comments.deletedAt),
      ),
    )
    .limit(1)
  if (row) return row.side as 'left' | 'right'
  if (hint === 'left' || hint === 'right' || hint === 'spectator') return hint
  return 'spectator'
}
