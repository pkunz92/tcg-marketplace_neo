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
    'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 2xl:grid-cols-11 gap-3'

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
