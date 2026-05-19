import { describe, expect, it } from 'vitest'
import { canChat, canPostComment, canReact, canReply, decideToggle } from './reaction'

describe('canReact', () => {
  it('spectator는 empathy만 허용', () => {
    expect(canReact('spectator', 'empathy')).toBe(true)
    expect(canReact('spectator', 'dopamine')).toBe(false)
  })
  it('left/right는 둘 다 허용', () => {
    expect(canReact('left', 'empathy')).toBe(true)
    expect(canReact('left', 'dopamine')).toBe(true)
    expect(canReact('right', 'empathy')).toBe(true)
    expect(canReact('right', 'dopamine')).toBe(true)
  })
})

describe('canReply / canPostComment / canChat', () => {
  it('spectator는 작성형 액션 모두 차단', () => {
    expect(canReply('spectator')).toBe(false)
    expect(canPostComment('spectator')).toBe(false)
    expect(canChat('spectator')).toBe(false)
  })
  it('left/right는 작성형 액션 허용', () => {
    expect(canReply('left')).toBe(true)
    expect(canPostComment('right')).toBe(true)
    expect(canChat('left')).toBe(true)
  })
})

describe('decideToggle', () => {
  it('없으면 INSERT, 있으면 DELETE', () => {
    expect(decideToggle(false)).toEqual({ kind: 'INSERT' })
    expect(decideToggle(true)).toEqual({ kind: 'DELETE' })
  })
})
