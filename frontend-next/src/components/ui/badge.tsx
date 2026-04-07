import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-elevated text-slate-400 border border-border',
  success: 'bg-green-950 text-green-400',
  warning: 'bg-yellow-950 text-yellow-400',
  danger: 'bg-red-950 text-red-400',
  info: 'bg-blue-950 text-blue-400',
}

const statusVariantMap: Record<string, BadgeVariant> = {
  PENDING: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  SHIPPED: 'info',
}

export function statusVariant(status: string): BadgeVariant {
  return statusVariantMap[status] ?? 'default'
}

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
}

export default function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
