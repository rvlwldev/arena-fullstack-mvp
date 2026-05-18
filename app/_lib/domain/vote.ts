export type VoteValue = 1 | -1

export type VoteOperation =
  | { kind: 'INSERT'; value: VoteValue }
  | { kind: 'UPDATE'; value: VoteValue }
  | { kind: 'NOOP' }
  | { kind: 'DELETE' }

export interface VoteContext {
  existing: VoteValue | null
  requested: VoteValue | null
}

/**
 * 현재 투표 상태와 요청을 받아 DB 연산을 결정한다.
 * - existing=null, requested=v -> INSERT
 * - existing=v, requested=v -> NOOP (멱등)
 * - existing=v, requested=v' (v≠v') -> UPDATE
 * - existing=v, requested=null -> DELETE (취소)
 * - existing=null, requested=null -> NOOP
 */
export function decideVoteOperation({ existing, requested }: VoteContext): VoteOperation {
  if (requested == null) {
    return existing == null ? { kind: 'NOOP' } : { kind: 'DELETE' }
  }
  if (existing == null) {
    return { kind: 'INSERT', value: requested }
  }
  if (existing === requested) {
    return { kind: 'NOOP' }
  }
  return { kind: 'UPDATE', value: requested }
}
