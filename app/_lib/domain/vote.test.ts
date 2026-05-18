import { describe, expect, it } from 'vitest'
import { decideVoteOperation } from './vote'

describe('decideVoteOperation', () => {
  it('투표 없음 + 좋아요 요청 → INSERT(+1)', () => {
    expect(decideVoteOperation({ existing: null, requested: 1 })).toEqual({ kind: 'INSERT', value: 1 })
  })

  it('투표 없음 + 싫어요 요청 → INSERT(-1)', () => {
    expect(decideVoteOperation({ existing: null, requested: -1 })).toEqual({ kind: 'INSERT', value: -1 })
  })

  it('같은 값 재요청 → NOOP (멱등)', () => {
    expect(decideVoteOperation({ existing: 1, requested: 1 })).toEqual({ kind: 'NOOP' })
    expect(decideVoteOperation({ existing: -1, requested: -1 })).toEqual({ kind: 'NOOP' })
  })

  it('좋아요 → 싫어요 토글 → UPDATE(-1)', () => {
    expect(decideVoteOperation({ existing: 1, requested: -1 })).toEqual({ kind: 'UPDATE', value: -1 })
  })

  it('싫어요 → 좋아요 토글 → UPDATE(+1)', () => {
    expect(decideVoteOperation({ existing: -1, requested: 1 })).toEqual({ kind: 'UPDATE', value: 1 })
  })

  it('투표 있음 + 취소 요청 → DELETE', () => {
    expect(decideVoteOperation({ existing: 1, requested: null })).toEqual({ kind: 'DELETE' })
    expect(decideVoteOperation({ existing: -1, requested: null })).toEqual({ kind: 'DELETE' })
  })

  it('투표 없음 + 취소 요청 → NOOP', () => {
    expect(decideVoteOperation({ existing: null, requested: null })).toEqual({ kind: 'NOOP' })
  })
})
