import CardThumbnail from './CardThumbnail'
import Skeleton from '../ui/Skeleton'

function CardSkeleton() {
  return (
    <div>
      <Skeleton className="w-full rounded-xl" style={{ aspectRatio: '63/88' }} />
      <Skeleton className="mt-2 h-3 w-3/4 rounded" />
      <Skeleton className="mt-1 h-3 w-1/2 rounded" />
    </div>
  )
}

export default function CardGrid({ cards, loading, skeletonCount = 20 }) {
  const gridClass =
    'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 2xl:grid-cols-8 gap-4'

  if (loading) {
    return (
      <div className={gridClass}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className={gridClass}>
      {cards.map((card) => (
        <CardThumbnail key={card.api_id} card={card} />
      ))}
    </div>
  )
}
