import { Star } from 'lucide-react'

interface SellerRepBadgeProps {
  score: number | null
  totalReviews: number
  size?: 'sm' | 'md'
}

export default function SellerRepBadge({ score, totalReviews, size = 'sm' }: SellerRepBadgeProps) {
  if (totalReviews === 0 || score === null) {
    return (
      <span className={`inline-flex items-center gap-1 text-slate-500 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
        <Star size={size === 'sm' ? 11 : 14} className="text-slate-600" />
        No reviews
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
      <Star size={size === 'sm' ? 11 : 14} className="fill-yellow-400 text-yellow-400" />
      <span className="text-yellow-300 font-medium">{score.toFixed(1)}</span>
      <span className="text-slate-500">({totalReviews})</span>
    </span>
  )
}
