import { describe, expect, it } from 'vitest'
import { computeResult, type CommentVotes } from './score'

const ts = (n: number) => new Date(`2026-05-18T12:00:${String(n).padStart(2, '0')}Z`)

describe('computeResult', () => {
  it('빈 입력 → 양쪽 빈 배열, TIE', () => {
    expect(computeResult([])).toEqual({ sideATop3: [], sideBTop3: [], winnerSide: 'TIE' })
  })

  it('각 진영 TOP3 정렬: score DESC, createdAt ASC', () => {
    const data: CommentVotes[] = [
      { commentId: 'a1', side: 'A', likes: 5, dislikes: 1, createdAt: ts(1) },
      { commentId: 'a2', side: 'A', likes: 10, dislikes: 0, createdAt: ts(5) },
      { commentId: 'a3', side: 'A', likes: 10, dislikes: 0, createdAt: ts(2) },
      { commentId: 'a4', side: 'A', likes: 3, dislikes: 0, createdAt: ts(3) },
      { commentId: 'b1', side: 'B', likes: 2, dislikes: 0, createdAt: ts(1) },
    ]
    const r = computeResult(data)
    expect(r.sideATop3.map((c) => c.commentId)).toEqual(['a3', 'a2', 'a1'])
  })

  it('승자 결정: 진영별 TOP3 점수 합 비교', () => {
    const data: CommentVotes[] = [
      { commentId: 'a1', side: 'A', likes: 10, dislikes: 0, createdAt: ts(1) },
      { commentId: 'a2', side: 'A', likes: 5, dislikes: 0, createdAt: ts(2) },
      { commentId: 'b1', side: 'B', likes: 20, dislikes: 0, createdAt: ts(1) },
    ]
    const r = computeResult(data)
    expect(r.sideATop3.reduce((s, c) => s + c.score, 0)).toBe(15)
    expect(r.sideBTop3.reduce((s, c) => s + c.score, 0)).toBe(20)
    expect(r.winnerSide).toBe('B')
  })

  it('TOP3 합이 동률이면 TIE', () => {
    const data: CommentVotes[] = [
      { commentId: 'a1', side: 'A', likes: 5, dislikes: 0, createdAt: ts(1) },
      { commentId: 'b1', side: 'B', likes: 5, dislikes: 0, createdAt: ts(1) },
    ]
    expect(computeResult(data).winnerSide).toBe('TIE')
  })

  it('음수 점수도 정상 계산되며 TOP3에 포함', () => {
    const data: CommentVotes[] = [
      { commentId: 'a1', side: 'A', likes: 0, dislikes: 3, createdAt: ts(1) },
      { commentId: 'a2', side: 'A', likes: 2, dislikes: 1, createdAt: ts(2) },
      { commentId: 'b1', side: 'B', likes: 0, dislikes: 0, createdAt: ts(1) },
    ]
    const r = computeResult(data)
    expect(r.sideATop3[0].commentId).toBe('a2')
    expect(r.sideATop3[1].commentId).toBe('a1')
    expect(r.sideATop3[1].score).toBe(-3)
    // A 합계 -2, B 합계 0 → B 승
    expect(r.winnerSide).toBe('B')
  })

  it('TOP3 초과 의견은 제외', () => {
    const data: CommentVotes[] = Array.from({ length: 5 }, (_, i) => ({
      commentId: `a${i}`,
      side: 'A' as const,
      likes: 5 - i,
      dislikes: 0,
      createdAt: ts(i + 1),
    }))
    expect(computeResult(data).sideATop3).toHaveLength(3)
  })
})
