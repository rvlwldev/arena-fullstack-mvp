import { describe, expect, it } from 'vitest'
import { canEditComment, EDIT_WINDOW_MS } from './edit-window'

const now = new Date('2026-05-18T12:00:00Z')

describe('canEditComment', () => {
  it('ACTIVE + 5분 이내 + 미삭제 → 허용', () => {
    expect(
      canEditComment(now, {
        createdAt: new Date(now.getTime() - 4 * 60 * 1000),
        deletedAt: null,
        issueStatus: 'ACTIVE',
      }),
    ).toEqual({ ok: true })
  })

  it('정확히 경계(5분)는 허용', () => {
    expect(
      canEditComment(now, {
        createdAt: new Date(now.getTime() - EDIT_WINDOW_MS),
        deletedAt: null,
        issueStatus: 'ACTIVE',
      }),
    ).toEqual({ ok: true })
  })

  it('5분 1ms 초과 → WINDOW_EXPIRED', () => {
    expect(
      canEditComment(now, {
        createdAt: new Date(now.getTime() - EDIT_WINDOW_MS - 1),
        deletedAt: null,
        issueStatus: 'ACTIVE',
      }),
    ).toEqual({ ok: false, reason: 'WINDOW_EXPIRED' })
  })

  it('이미 삭제된 의견 → DELETED', () => {
    expect(
      canEditComment(now, {
        createdAt: new Date(now.getTime() - 1000),
        deletedAt: new Date(now.getTime() - 500),
        issueStatus: 'ACTIVE',
      }),
    ).toEqual({ ok: false, reason: 'DELETED' })
  })

  it('이슈가 RESULT면 거부', () => {
    expect(
      canEditComment(now, {
        createdAt: new Date(now.getTime() - 1000),
        deletedAt: null,
        issueStatus: 'RESULT',
      }),
    ).toEqual({ ok: false, reason: 'ISSUE_NOT_ACTIVE' })
  })

  it('이슈가 DRAFT면 거부', () => {
    expect(
      canEditComment(now, {
        createdAt: new Date(now.getTime() - 1000),
        deletedAt: null,
        issueStatus: 'DRAFT',
      }),
    ).toEqual({ ok: false, reason: 'ISSUE_NOT_ACTIVE' })
  })
})
