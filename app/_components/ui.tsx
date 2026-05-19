import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(' ')
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'red' | 'blue' | 'gradient'
  size?: 'sm' | 'md'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, ...rest },
  ref,
) {
  const variantCls =
    variant === 'primary'
      ? 'bg-white text-neutral-900 hover:bg-white/90 disabled:bg-white/40'
      : variant === 'secondary'
      ? 'border border-white/15 bg-white/5 text-white/85 hover:bg-white/10'
      : variant === 'danger'
      ? 'bg-[var(--arena-red)] text-white hover:brightness-110'
      : variant === 'ghost'
      ? 'bg-transparent text-white/65 hover:bg-white/5'
      : variant === 'red'
      ? 'bg-[var(--arena-red)]/20 text-[var(--arena-red)] ring-1 ring-inset ring-[var(--arena-red)]/40 hover:bg-[var(--arena-red)]/25'
      : variant === 'blue'
      ? 'bg-[var(--arena-blue)]/20 text-[var(--arena-blue)] ring-1 ring-inset ring-[var(--arena-blue)]/40 hover:bg-[var(--arena-blue)]/25'
      : 'bg-gradient-to-r from-[var(--arena-red)] via-fuchsia-700/80 to-[var(--arena-blue)] text-white hover:brightness-110'
  const sizeCls = size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm'
  return (
    <button
      ref={ref}
      className={cx(
        'inline-flex items-center justify-center rounded-md font-black tracking-tight transition disabled:cursor-not-allowed disabled:opacity-50',
        variantCls,
        sizeCls,
        className,
      )}
      {...rest}
    />
  )
})

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cx(
          'h-10 w-full rounded-md border border-white/12 bg-black/40 px-3 text-sm font-bold text-white outline-none placeholder:text-white/30 focus:border-[var(--arena-blue)]/60',
          className,
        )}
        {...rest}
      />
    )
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cx(
          'w-full resize-none rounded-md border border-white/12 bg-black/40 p-3 text-sm font-bold text-white outline-none placeholder:text-white/30 focus:border-[var(--arena-blue)]/60',
          className,
        )}
        {...rest}
      />
    )
  },
)

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'rounded-xl border border-white/10 bg-[var(--arena-panel)]/80 p-4 ring-1 ring-inset ring-white/5 sm:p-5',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function Pill({
  tone,
  children,
}: {
  tone: 'left' | 'right' | 'neutral' | 'amber' | 'live'
  children: React.ReactNode
}) {
  const cls =
    tone === 'left'
      ? 'bg-[var(--arena-blue)]/20 text-[var(--arena-blue)] ring-[var(--arena-blue)]/35'
      : tone === 'right'
      ? 'bg-[var(--arena-red)]/20 text-[var(--arena-red)] ring-[var(--arena-red)]/35'
      : tone === 'amber'
      ? 'bg-amber-500/15 text-amber-200 ring-amber-500/35'
      : tone === 'live'
      ? 'animate-live-blink bg-red-600/90 text-white ring-red-600/40'
      : 'bg-white/8 text-white/70 ring-white/15'
  return (
    <span
      className={cx(
        'inline-flex items-center rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ring-1 ring-inset',
        cls,
      )}
    >
      {children}
    </span>
  )
}

export function StatNumber({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/12 bg-black/50 px-2 py-3 text-center ring-1 ring-inset ring-white/5 sm:px-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-white/40">{label}</p>
      <p className="mt-1 font-mono text-lg font-black tabular-nums text-white sm:text-xl">{value}</p>
    </div>
  )
}

export function StatusBadge({ status }: { status: 'DRAFT' | 'ACTIVE' | 'RESULT' | 'ARCHIVED' | 'CLEANED' }) {
  if (status === 'ACTIVE') {
    return <Pill tone="live">진행중</Pill>
  }
  if (status === 'RESULT') {
    return <Pill tone="amber">결과 노출중</Pill>
  }
  return <Pill tone="neutral">{status}</Pill>
}
