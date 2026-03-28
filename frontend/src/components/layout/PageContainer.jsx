import { cn } from '../../lib/utils'

export default function PageContainer({ children, className }) {
  return (
    <div className={cn('max-w-[1600px] mx-auto px-4 sm:px-6 xl:px-12 py-8', className)}>
      {children}
    </div>
  )
}
