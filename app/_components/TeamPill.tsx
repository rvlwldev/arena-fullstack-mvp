import type { Side } from '@/app/_lib/domain/score'

export function TeamPill({ team, label }: { team: Side; label: string }) {
  const cls =
    team === 'left'
      ? 'bg-[var(--arena-blue)]/20 text-[var(--arena-blue)] ring-[var(--arena-blue)]/35'
      : 'bg-[var(--arena-red)]/20 text-[var(--arena-red)] ring-[var(--arena-red)]/35'
  return (
    <span className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-black ring-1 ring-inset ${cls}`}>
      {label}
    </span>
  )
}

export function RoleBadge({ role }: { role: 'left' | 'right' | 'spectator' | null }) {
  if (!role) return null
  if (role === 'spectator') {
    return (
      <span className="rounded bg-white/10 px-1.5 py-px text-[10px] font-black text-white/80 ring-1 ring-white/20">
        눈팅 중
      </span>
    )
  }
  const cls =
    role === 'left'
      ? 'bg-[var(--arena-blue)]/20 text-[var(--arena-blue)] ring-[var(--arena-blue)]/35'
      : 'bg-[var(--arena-red)]/20 text-[var(--arena-red)] ring-[var(--arena-red)]/35'
  return (
    <span className={`rounded px-1.5 py-px text-[10px] font-black ring-1 ${cls}`}>
      내 진영
    </span>
  )
}
