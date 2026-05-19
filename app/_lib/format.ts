export function formatCountKR(n: number): string {
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(n)
}

export function formatHHMMSS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

export function elapsedSecondsSince(startIso: string | Date): number {
  const start = new Date(startIso).getTime()
  return Math.max(0, Math.floor((Date.now() - start) / 1000))
}

/**
 * 사용자 친화적 남은 시간 표시: "3일 4시간 남음" / "12시간 남음" / "5분 남음"
 */
export function remainingHumanKR(target: string | Date | null | undefined): string {
  if (!target) return ''
  const ms = new Date(target).getTime() - Date.now()
  if (ms <= 0) return '곧 해제'
  const totalMin = Math.floor(ms / 60_000)
  const days = Math.floor(totalMin / (60 * 24))
  const hours = Math.floor((totalMin % (60 * 24)) / 60)
  const mins = totalMin % 60
  if (days > 0) return hours > 0 ? `${days}일 ${hours}시간 남음` : `${days}일 남음`
  if (hours > 0) return mins > 0 ? `${hours}시간 ${mins}분 남음` : `${hours}시간 남음`
  return `${mins}분 남음`
}
