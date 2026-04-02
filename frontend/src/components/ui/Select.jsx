import { cn } from '../../lib/utils'
import { forwardRef } from 'react'

const Select = forwardRef(function Select({ label, error, className, children, ...props }, ref) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-slate-300">{label}</label>}
      <select
        ref={ref}
        className={cn(
          'bg-surface border border-border rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-accent-500 transition-colors',
          error && 'border-red-500',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
})

export default Select
