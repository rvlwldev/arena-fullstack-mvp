import { describe, expect, it } from 'vitest'
import { deriveIssueStatus, validateIssueWindow } from './issue-status'

const t = (iso: string) => new Date(iso)

describe('deriveIssueStatus', () => {
  const w = {
    opensAt: t('2026-05-18T10:00:00Z'),
    closesAt: t('2026-05-18T12:00:00Z'),
    resultAt: t('2026-05-18T14:00:00Z'),
  }

  it('opens_at 이전이면 DRAFT', () => {
    expect(deriveIssueStatus(t('2026-05-18T09:59:59Z'), w)).toBe('DRAFT')
  })

  it('opens_at 시점에는 ACTIVE', () => {
    expect(deriveIssueStatus(t('2026-05-18T10:00:00Z'), w)).toBe('ACTIVE')
  })

  it('opens_at < now < closes_at 이면 ACTIVE', () => {
    expect(deriveIssueStatus(t('2026-05-18T11:30:00Z'), w)).toBe('ACTIVE')
  })

  it('closes_at 시점에는 RESULT', () => {
    expect(deriveIssueStatus(t('2026-05-18T12:00:00Z'), w)).toBe('RESULT')
  })

  it('closes_at < now < result_at 이면 RESULT', () => {
    expect(deriveIssueStatus(t('2026-05-18T13:00:00Z'), w)).toBe('RESULT')
  })

  it('result_at 시점에는 ARCHIVED', () => {
    expect(deriveIssueStatus(t('2026-05-18T14:00:00Z'), w)).toBe('ARCHIVED')
  })
})

describe('validateIssueWindow', () => {
  it('정상 윈도우는 null 반환', () => {
    expect(
      validateIssueWindow({
        opensAt: t('2026-05-18T10:00:00Z'),
        closesAt: t('2026-05-18T12:00:00Z'),
        resultAt: t('2026-05-18T14:00:00Z'),
      }),
    ).toBeNull()
  })

  it('opens_at >= closes_at 이면 에러', () => {
    expect(
      validateIssueWindow({
        opensAt: t('2026-05-18T12:00:00Z'),
        closesAt: t('2026-05-18T12:00:00Z'),
        resultAt: t('2026-05-18T14:00:00Z'),
      }),
    ).toMatch(/opens_at/)
  })

  it('closes_at >= result_at 이면 에러', () => {
    expect(
      validateIssueWindow({
        opensAt: t('2026-05-18T10:00:00Z'),
        closesAt: t('2026-05-18T14:00:00Z'),
        resultAt: t('2026-05-18T14:00:00Z'),
      }),
    ).toMatch(/result_at/)
  })
})
