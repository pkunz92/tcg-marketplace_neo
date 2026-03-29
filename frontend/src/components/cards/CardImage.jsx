import { useState } from 'react'
import { cn } from '../../lib/utils'
import Skeleton from '../ui/Skeleton'

export default function CardImage({ src, alt, className }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  const hasSrc = Boolean(src)

  return (
    <div className={cn('relative', className)}>
      {!loaded && !error && hasSrc && <Skeleton className="absolute inset-0 rounded-xl" />}
      {(!hasSrc || error) ? (
        <div className="w-full h-full bg-surface rounded-xl flex items-center justify-center text-slate-600">
          <svg viewBox="0 0 100 140" className="w-1/2 opacity-40" fill="currentColor">
            <rect width="100" height="140" rx="8" />
          </svg>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={cn(
            'w-full h-full object-contain rounded-xl transition-opacity duration-300',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
    </div>
  )
}
