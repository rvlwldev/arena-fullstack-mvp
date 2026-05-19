import { describe, expect, it } from 'vitest'
import { commentScore, computeResult, rebuttalLabel, type CommentReactions } from './score'

const ts = (n: number) => new Date(`2026-05-18T12:00:${String(n).padStart(2, '0')}Z`)

describe('commentScore', () => {
  it('공식: empathy + rebuttal + dopamine × 5', () => {
    expect(commentScore({ empathy: 3, rebuttal: 2, dopamine: 1 })).toBe(3 + 2 + 1 * 5)
    expect(commentScore({ empathy: 0, rebuttal: 0, dopamine: 0 })).toBe(0)
    expect(commentScore({ empathy: 10, rebuttal: 0, dopamine: 0 })).toBe(10)
    expect(commentScore({ empathy: 0, rebuttal: 0, dopamine: 5 })).toBe(25)
  })
})

describe('computeResult', () => {
  it('빈 입력 → 양쪽 빈 배열, TIE', () => {
    expect(computeResult([])).toEqual({ sideATop3: [], sideBTop3: [], winnerSide: 'TIE' })
  })

  it('각 진영 TOP3 정렬: score DESC, createdAt ASC', () => {
    const data: CommentReactions[] = [
      { commentId: 'l1', side: 'left', empathy: 5, rebuttal: 0, dopamine: 0, createdAt: ts(1) },
      { commentId: 'l2', side: 'left', empathy: 0, rebuttal: 0, dopamine: 2, createdAt: ts(5) }, // 10
      { commentId: 'l3', side: 'left', empathy: 0, rebuttal: 0, dopamine: 2, createdAt: ts(2) }, // 10
      { commentId: 'l4', side: 'left', empathy: 3, rebuttal: 0, dopamine: 0, createdAt: ts(3) },
      { commentId: 'r1', side: 'right', empathy: 2, rebuttal: 0, dopamine: 0, createdAt: ts(1) },
    ]
    const r = computeResult(data)
    // l2, l3은 10 동점이라 createdAt이 빠른 l3가 먼저, 그 다음 l2, 그 다음 l1(5)
    expect(r.sideATop3.map((c) => c.commentId)).toEqual(['l3', 'l2', 'l1'])
  })

  it('승자 결정: 진영별 TOP3 점수 합 비교', () => {
    const data: CommentReactions[] = [
      { commentId: 'l1', side: 'left', empathy: 10, rebuttal: 0, dopamine: 0, createdAt: ts(1) },
      { commentId: 'r1', side: 'right', empathy: 0, rebuttal: 0, dopamine: 3, createdAt: ts(1) }, // 15
    ]
    const r = computeResult(data)
    expect(r.sideATop3.reduce((s, c) => s + c.score, 0)).toBe(10)
    expect(r.sideBTop3.reduce((s, c) => s + c.score, 0)).toBe(15)
    expect(r.winnerSide).toBe('right')
  })

  it('TOP3 합이 동률이면 TIE', () => {
    const data: CommentReactions[] = [
      { commentId: 'l1', side: 'left', empathy: 5, rebuttal: 0, dopamine: 0, createdAt: ts(1) },
      { commentId: 'r1', side: 'right', empathy: 5, rebuttal: 0, dopamine: 0, createdAt: ts(1) },
    ]
    expect(computeResult(data).winnerSide).toBe('TIE')
  })

  it('rebuttal(답글 unique 카운트)도 점수에 1배수로 가산', () => {
    const data: CommentReactions[] = [
      { commentId: 'l1', side: 'left', empathy: 0, rebuttal: 7, dopamine: 0, createdAt: ts(1) },
      { commentId: 'r1', side: 'right', empathy: 3, rebuttal: 0, dopamine: 0, createdAt: ts(1) },
    ]
    const r = computeResult(data)
    expect(r.sideATop3[0].score).toBe(7)
    expect(r.sideBTop3[0].score).toBe(3)
    expect(r.winnerSide).toBe('left')
  })

  it('TOP3 초과 의견은 제외', () => {
    const data: CommentReactions[] = Array.from({ length: 5 }, (_, i) => ({
      commentId: `l${i}`,
      side: 'left' as const,
      empathy: 5 - i,
      rebuttal: 0,
      dopamine: 0,
      createdAt: ts(i + 1),
    }))
    expect(computeResult(data).sideATop3).toHaveLength(3)
  })
})

describe('rebuttalLabel', () => {
  it('5미만은 null', () => {
    expect(rebuttalLabel(0)).toBeNull()
    expect(rebuttalLabel(4)).toBeNull()
  })
  it('5+ 몰림(tier1), 10+ 폭주(tier2), 15+ 터짐(tier3)', () => {
    expect(rebuttalLabel(5)).toEqual({ label: '반박 몰림', tier: 1 })
    expect(rebuttalLabel(10)).toEqual({ label: '반박 폭주', tier: 2 })
    expect(rebuttalLabel(15)).toEqual({ label: '전장 터짐', tier: 3 })
    expect(rebuttalLabel(99)).toEqual({ label: '전장 터짐', tier: 3 })
  })
})
