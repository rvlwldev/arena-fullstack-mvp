import Link from 'next/link'

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const cls =
    size === 'sm'
      ? 'text-sm sm:text-base'
      : size === 'lg'
      ? 'text-2xl sm:text-3xl'
      : 'text-xl sm:text-2xl'
  return (
    <Link href="/" className={`${cls} font-black tracking-tight`}>
      <span className="text-[var(--arena-red)]">빨</span>
      <span className="text-[var(--arena-blue)]">파</span>
      <span className="text-white">레나</span>
    </Link>
  )
}
