export const EDIT_WINDOW_MS = 5 * 60 * 1000

export interface EditableInput {
  createdAt: Date
  deletedAt: Date | null
  issueStatus: 'DRAFT' | 'ACTIVE' | 'RESULT' | 'ARCHIVED' | 'CLEANED'
}

export type EditDecision =
  | { ok: true }
  | { ok: false; reason: 'DELETED' | 'WINDOW_EXPIRED' | 'ISSUE_NOT_ACTIVE' }

/**
 * 의견(comment)의 수정/삭제 허용 여부.
 * - 이미 삭제된 의견 불가
 * - 이슈가 ACTIVE 상태일 때만 허용
 * - 생성 후 EDIT_WINDOW_MS 이내일 때만 허용
 */
export function canEditComment(now: Date, input: EditableInput): EditDecision {
  if (input.deletedAt) return { ok: false, reason: 'DELETED' }
  if (input.issueStatus !== 'ACTIVE') return { ok: false, reason: 'ISSUE_NOT_ACTIVE' }
  const elapsed = now.getTime() - input.createdAt.getTime()
  if (elapsed > EDIT_WINDOW_MS) return { ok: false, reason: 'WINDOW_EXPIRED' }
  return { ok: true }
}
