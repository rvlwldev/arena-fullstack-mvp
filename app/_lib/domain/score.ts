export type Side = 'left' | 'right'

export interface CommentVotes {
  commentId: string
  side: Side
  /** empathy 카운트 */
  likes: number
  /** dopamine 카운트로 재해석 가능. 점수 공식은 별도 함수 사용 */
  dislikes: number
  createdAt: Date
}

export interface ScoredComment {
  commentId: string
  score: number
  likes: number
  dislikes: number
}

export interface ResultSnapshot {
  sideATop3: ScoredComment[]
  sideBTop3: ScoredComment[]
  winnerSide: 'left' | 'right' | 'TIE'
}

function score(c: CommentVotes): ScoredComment {
  return {
    commentId: c.commentId,
    likes: c.likes,
    dislikes: c.dislikes,
    score: c.likes - c.dislikes,
  }
}

/**
 * 진영별 TOP3와 승자를 산출한다.
 * 정렬: score DESC, createdAt ASC (먼저 등록된 의견 우선)
 * 승부: 양 진영 TOP3 점수 총합 비교, 동률은 TIE
 *
 * NOTE: v2에서는 별도 computeResultV2 함수가 empathy/rebuttal/dopamine 기반 공식을 사용한다.
 *       이 함수는 V1 호환을 위해 유지 (점수 = likes - dislikes).
 */
export function computeResult(comments: CommentVotes[]): ResultSnapshot {
  const sortedA = comments
    .filter((c) => c.side === 'left')
    .slice()
    .sort((x, y) => y.likes - y.dislikes - (x.likes - x.dislikes) || x.createdAt.getTime() - y.createdAt.getTime())
  const sortedB = comments
    .filter((c) => c.side === 'right')
    .slice()
    .sort((x, y) => y.likes - y.dislikes - (x.likes - x.dislikes) || x.createdAt.getTime() - y.createdAt.getTime())

  const sideATop3 = sortedA.slice(0, 3).map(score)
  const sideBTop3 = sortedB.slice(0, 3).map(score)

  const sumA = sideATop3.reduce((acc, c) => acc + c.score, 0)
  const sumB = sideBTop3.reduce((acc, c) => acc + c.score, 0)

  const winnerSide: 'left' | 'right' | 'TIE' = sumA > sumB ? 'left' : sumB > sumA ? 'right' : 'TIE'

  return { sideATop3, sideBTop3, winnerSide }
}
