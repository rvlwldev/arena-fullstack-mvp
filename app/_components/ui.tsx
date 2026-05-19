import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(' ')
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, ...rest },
  ref,
) {
  const variantCls =
    variant === 'primary'
      ? 'bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-400'
      : variant === 'secondary'
      ? 'bg-white text-neutral-900 border border-neutral-300 hover:bg-neutral-100'
      : variant === 'danger'
      ? 'bg-red-600 text-white hover:bg-red-700'
      : 'bg-transparent text-neutral-700 hover:bg-neutral-100'
  const sizeCls = size === 'sm' ? 'h-8 px-3 text-sm' : 'h-10 px-4'
  return (
    <button
      ref={ref}
      className={cx(
        'inline-flex items-center justify-center rounded-md font-medium transition disabled:cursor-not-allowed',
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
          'h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-neutral-900',
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
          'w-full rounded-md border border-neutral-300 bg-white p-3 text-sm outline-none focus:border-neutral-900',
          className,
        )}
        {...rest}
      />
    )
  },
)

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-lg border border-neutral-200 bg-white p-5 shadow-sm', className)}>
      {children}
    </div>
  )
}

export function Pill({ tone, children }: { tone: 'left' | 'right' | 'neutral'; children: React.ReactNode }) {
  const cls =
    tone === 'left'
      ? 'bg-blue-100 text-blue-700'
      : tone === 'right'
      ? 'bg-red-100 text-red-700'
      : 'bg-neutral-100 text-neutral-700'
  return (
    <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold', cls)}>
      {children}
    </span>
  )
}
