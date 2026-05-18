export type IssueStatus = 'DRAFT' | 'ACTIVE' | 'RESULT' | 'ARCHIVED' | 'CLEANED'

export interface IssueTimeWindow {
  opensAt: Date
  closesAt: Date
  resultAt: Date
}

/**
 * 시간 필드만으로 status를 결정한다. CLEANED는 별도 잡이 표시하는 상태이며
 * 시간 기반으로 자동 도출되지 않는다.
 */
export function deriveIssueStatus(
  now: Date,
  { opensAt, closesAt, resultAt }: IssueTimeWindow,
): Exclude<IssueStatus, 'CLEANED'> {
  if (now < opensAt) return 'DRAFT'
  if (now < closesAt) return 'ACTIVE'
  if (now < resultAt) return 'RESULT'
  return 'ARCHIVED'
}

/**
 * 입력된 opens/closes/result 시각이 엄격히 증가하는지 검증한다.
 */
export function validateIssueWindow(w: IssueTimeWindow): string | null {
  if (!(w.opensAt < w.closesAt)) return 'opens_at은 closes_at보다 빨라야 합니다.'
  if (!(w.closesAt < w.resultAt)) return 'closes_at은 result_at보다 빨라야 합니다.'
  return null
}
