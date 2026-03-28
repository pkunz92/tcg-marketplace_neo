import { cn } from '../../lib/utils'

export default function Skeleton({ className }) {
  return (
    <div
      className={cn(
        'rounded-lg bg-gradient-to-r from-surface via-elevated to-surface bg-[length:200%_100%] animate-shimmer',
        className,
      )}
    />
  )
}
