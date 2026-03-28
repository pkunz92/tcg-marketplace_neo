import { cn } from '../../lib/utils'

export default function PageContainer({ children, className }) {
  return (
    <div className={cn('w-full px-4 sm:px-6 xl:px-12 py-8', className)}>
      {children}
    </div>
  )
}
