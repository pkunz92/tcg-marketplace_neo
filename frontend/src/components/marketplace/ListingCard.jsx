import { Link } from 'react-router-dom'
import { useState } from 'react'
import CardImage from '../cards/CardImage'
import PriceTag from '../cards/PriceTag'
import ConditionBadge from '../cards/ConditionBadge'
import Button from '../ui/Button'
import BuyModal from './BuyModal'
import { useAuth } from '../../context/AuthContext'

export default function ListingCard({ listing }) {
  const { isAuthenticated } = useAuth()
  const [buying, setBuying] = useState(false)

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden hover:border-accent-500/40 transition-colors group">
      <Link to={`/cards/${listing.card_master_api_id}`} className="block p-3">
        <div style={{ aspectRatio: '63/88' }}>
          <CardImage
            src={listing.card_image_url}
            alt={listing.card_name}
            className="w-full h-full group-hover:scale-[1.02] transition-transform duration-300"
          />
        </div>
      </Link>
      <div className="p-3 border-t border-border">
        <Link
          to={`/cards/${listing.card_master_api_id}`}
          className="text-sm font-medium text-slate-200 hover:text-accent-400 transition-colors truncate block"
        >
          {listing.card_name}
        </Link>
        <p className="text-xs text-slate-500 truncate mt-0.5">{listing.set_name}</p>
        <div className="flex items-center justify-between mt-2">
          <ConditionBadge condition={listing.condition} />
          <PriceTag price={listing.price_chf} />
        </div>
        <Button
          size="sm"
          className="w-full mt-2"
          onClick={() => setBuying(true)}
          disabled={!isAuthenticated}
        >
          {isAuthenticated ? 'Buy' : 'Sign in to buy'}
        </Button>
      </div>
      {buying && (
        <BuyModal
          listing={listing}
          card={{ card_name: listing.card_name, image_url: listing.card_image_url, api_id: listing.card_master_api_id }}
          onClose={() => setBuying(false)}
        />
      )}
    </div>
  )
}
