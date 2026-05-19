export type ReactionKind = 'empathy' | 'dopamine'
export type ArenaRole = 'left' | 'right' | 'spectator'

/**
 * 역할별 허용 반응 종류.
 * - spectator는 empathy만 가능
 * - left/right는 empathy, dopamine 모두 가능
 */
export function canReact(role: ArenaRole, kind: ReactionKind): boolean {
  if (kind === 'empathy') return true
  return role !== 'spectator'
}

/**
 * 답글(반박) 작성 허용 여부.
 * spectator는 작성 불가.
 */
export function canReply(role: ArenaRole): boolean {
  return role !== 'spectator'
}

/**
 * 의견 등록 허용 여부 (역할 기준; 시간/1인1회는 별도 검증).
 */
export function canPostComment(role: ArenaRole): boolean {
  return role !== 'spectator'
}

/**
 * 채팅 작성 허용 여부.
 * spectator는 채팅 불가 (디자인 정책).
 */
export function canChat(role: ArenaRole): boolean {
  return role !== 'spectator'
}

export type ToggleDecision = { kind: 'INSERT' } | { kind: 'DELETE' }

/**
 * 더블클릭 토글: 이미 반응이 있으면 삭제, 없으면 삽입.
 */
export function decideToggle(existing: boolean): ToggleDecision {
  return existing ? { kind: 'DELETE' } : { kind: 'INSERT' }
}
