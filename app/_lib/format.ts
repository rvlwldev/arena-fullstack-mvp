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
