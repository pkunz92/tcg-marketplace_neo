import { cn } from '../../lib/utils'

export default function Badge({ children, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border',
        className,
      )}
    >
      {children}
    </span>
  )
}
