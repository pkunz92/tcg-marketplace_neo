import { cn } from '../../lib/utils'
import Spinner from './Spinner'

const variants = {
  primary:   'bg-accent-500 hover:bg-accent-400 text-base font-semibold shadow-lg shadow-accent-500/20',
  secondary: 'bg-surface hover:bg-elevated border border-border text-slate-200',
  ghost:     'hover:bg-elevated text-slate-300 hover:text-slate-100',
  danger:    'bg-red-600 hover:bg-red-500 text-white font-semibold',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-6 py-3 text-base rounded-xl',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className,
  children,
  ...props
}) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  )
}
