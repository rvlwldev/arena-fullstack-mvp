export type Side = 'left' | 'right'

/**
 * 의견(comment) 단위 반응·답글 집계 입력.
 * - empathy: 공감 반응 수
 * - dopamine: 도파민 반응 수
 * - rebuttal: 답글 작성자 unique 수 (의견에 직접 단 답글)
 */
export interface CommentReactions {
  commentId: string
  side: Side
  empathy: number
  dopamine: number
  rebuttal: number
  createdAt: Date
}

export interface ScoredComment {
  commentId: string
  empathy: number
  dopamine: number
  rebuttal: number
  score: number
}

export interface ResultSnapshot {
  sideATop3: ScoredComment[]
  sideBTop3: ScoredComment[]
  winnerSide: 'left' | 'right' | 'TIE'
}

/**
 * 점수 공식: empathy + rebuttal + dopamine × 5
 */
export function commentScore(r: Pick<CommentReactions, 'empathy' | 'dopamine' | 'rebuttal'>): number {
  return r.empathy + r.rebuttal + r.dopamine * 5
}

function score(c: CommentReactions): ScoredComment {
  return {
    commentId: c.commentId,
    empathy: c.empathy,
    dopamine: c.dopamine,
    rebuttal: c.rebuttal,
    score: commentScore(c),
  }
}

/**
 * 진영별 TOP3와 승자를 산출한다.
 * 정렬: score DESC, createdAt ASC (먼저 등록된 의견 우선)
 * 승부: 양 진영 TOP3 점수 총합 비교, 동률은 TIE
 */
export function computeResult(comments: CommentReactions[]): ResultSnapshot {
  const sortBy = (xs: CommentReactions[]) =>
    xs
      .slice()
      .sort((a, b) => commentScore(b) - commentScore(a) || a.createdAt.getTime() - b.createdAt.getTime())

  const sortedLeft = sortBy(comments.filter((c) => c.side === 'left'))
  const sortedRight = sortBy(comments.filter((c) => c.side === 'right'))

  const sideATop3 = sortedLeft.slice(0, 3).map(score)
  const sideBTop3 = sortedRight.slice(0, 3).map(score)

  const sumL = sideATop3.reduce((s, c) => s + c.score, 0)
  const sumR = sideBTop3.reduce((s, c) => s + c.score, 0)

  const winnerSide: 'left' | 'right' | 'TIE' = sumL > sumR ? 'left' : sumR > sumL ? 'right' : 'TIE'

  return { sideATop3, sideBTop3, winnerSide }
}

/** 반박 라벨 (디자인 일관성용) */
export function rebuttalLabel(count: number): { label: string; tier: 1 | 2 | 3 } | null {
  if (count >= 15) return { label: '전장 터짐', tier: 3 }
  if (count >= 10) return { label: '반박 폭주', tier: 2 }
  if (count >= 5) return { label: '반박 몰림', tier: 1 }
  return null
}
