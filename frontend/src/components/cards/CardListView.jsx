import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { RarityBadge } from './CardBadge'
import PriceTag from './PriceTag'
import Skeleton from '../ui/Skeleton'

function ImageHover({ src, alt }) {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [visible, setVisible] = useState(false)
  const ref = useRef(null)

  function handleMouseMove(e) {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    // Position the preview to the right, or left if near screen edge
    const x = rect.right + 200 > window.innerWidth ? rect.left - 180 : rect.right + 8
    const y = Math.max(8, Math.min(e.clientY - 100, window.innerHeight - 220))
    setPos({ x, y })
  }

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onMouseMove={handleMouseMove}
    >
      <div className="w-8 h-11 rounded overflow-hidden bg-elevated border border-border shrink-0">
        {src && src.startsWith('http') ? (
          <img src={src} alt={alt} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-elevated" />
        )}
      </div>
      {visible && src && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: pos.x, top: pos.y }}
        >
          <img
            src={src}
            alt={alt}
            className="w-44 rounded-xl shadow-2xl border border-border"
            style={{ aspectRatio: '63/88' }}
          />
        </div>
      )}
    </div>
  )
}

function ListSkeleton({ count = 20 }) {
  return (
    <div className="flex flex-col divide-y divide-border">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-2.5 px-3">
          <Skeleton className="w-8 h-11 rounded shrink-0" />
          <Skeleton className="h-3 w-40 rounded" />
          <Skeleton className="h-3 w-24 rounded ml-auto" />
          <Skeleton className="h-3 w-16 rounded" />
          <Skeleton className="h-3 w-12 rounded" />
        </div>
      ))}
    </div>
  )
}

export default function CardListView({ cards, loading }) {
  if (loading) return <ListSkeleton />

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[2rem_1fr_auto_auto_auto] sm:grid-cols-[2rem_1fr_200px_120px_100px] gap-4 px-3 py-2 border-b border-border bg-elevated text-xs font-semibold uppercase tracking-wider text-slate-500">
        <span />
        <span>Card</span>
        <span className="hidden sm:block">Set</span>
        <span className="hidden sm:block text-right">Rarity</span>
        <span className="text-right">Price</span>
      </div>

      <div className="divide-y divide-border">
        {cards.map((card) => (
          <Link
            key={card.api_id}
            to={`/cards/${card.api_id}`}
            className="grid grid-cols-[2rem_1fr_auto_auto_auto] sm:grid-cols-[2rem_1fr_200px_120px_100px] gap-4 items-center px-3 py-2 hover:bg-elevated transition-colors group"
          >
            <ImageHover src={card.image_url} alt={card.card_name} />

            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-200 group-hover:text-accent-400 transition-colors truncate">
                {card.card_name}
              </p>
              <p className="text-xs text-slate-500">#{card.card_number}</p>
            </div>

            <p className="hidden sm:block text-sm text-slate-400 truncate">{card.set?.set_name}</p>

            <div className="hidden sm:flex justify-end">
              <RarityBadge rarity={card.card_rarity} />
            </div>

            <div className="flex justify-end">
              <PriceTag price={card.market_price} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
