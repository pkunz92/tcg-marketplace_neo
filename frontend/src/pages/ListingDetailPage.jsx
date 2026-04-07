import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ShoppingCart, Tag, Heart, ArrowLeft, Clock, Star, Package } from 'lucide-react'
import api from '../lib/api'
import PageContainer from '../components/layout/PageContainer'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import ConditionBadge from '../components/cards/ConditionBadge'
import BuyModal from '../components/marketplace/BuyModal'
import OfferModal from '../components/marketplace/OfferModal'
import { formatCHF, formatDate, GRADING_LABELS } from '../lib/utils'
import { useAuth } from '../context/AuthContext'

function useListing(id) {
  return useQuery({
    queryKey: ['listings', 'detail', id],
    queryFn: () => api.get(`/listings/${id}/`).then((r) => r.data),
    enabled: !!id,
  })
}

export default function ListingDetailPage() {
  const { listingId } = useParams()
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const { data: listing, isLoading, isError } = useListing(listingId)
  const [buying, setBuying] = useState(false)
  const [offering, setOffering] = useState(false)
  const [watchlisted, setWatchlisted] = useState(false)

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex justify-center py-32"><Spinner size="lg" /></div>
      </PageContainer>
    )
  }

  if (isError || !listing) {
    return (
      <PageContainer>
        <div className="text-center py-32">
          <p className="text-slate-400 mb-4">Listing not found or unavailable.</p>
          <Button variant="secondary" onClick={() => navigate('/market')}>Back to Marketplace</Button>
        </div>
      </PageContainer>
    )
  }

  const isSeller = user?.username === listing.seller_username
  const card = {
    card_name: listing.card_name,
    image_url: listing.card_image_url,
    api_id: listing.card_master_api_id,
  }
  const gradingLabel = GRADING_LABELS[listing.grading_company] || listing.grading_company

  return (
    <PageContainer>
      {/* Back nav */}
      <Link
        to="/market"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors mb-6"
      >
        <ArrowLeft size={15} />
        Back to Marketplace
      </Link>

      <div data-testid="listing-detail" className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        {/* Card image */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-full max-w-xs mx-auto rounded-2xl overflow-hidden shadow-2xl border border-border">
            <img
              src={listing.card_image_url}
              alt={listing.card_name}
              className="w-full object-contain"
              style={{ aspectRatio: '63/88' }}
            />
          </div>
          {listing.seller_photo_url && (
            <div>
              <p className="text-xs text-slate-500 mb-1 text-center">Seller photo</p>
              <img
                src={listing.seller_photo_url}
                alt="Seller photo"
                className="w-full max-w-xs mx-auto rounded-xl border border-border object-cover"
              />
            </div>
          )}
        </div>

        {/* Listing info */}
        <div className="flex flex-col gap-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">{listing.card_name}</h1>
            <p className="text-sm text-slate-400 mt-1">
              {listing.set_name} ·{' '}
              <Link
                to={`/cards/${listing.card_master_api_id}`}
                className="text-accent-400 hover:text-accent-300 transition-colors"
              >
                View card database page
              </Link>
            </p>
          </div>

          {/* Price */}
          <div className="bg-surface border border-border rounded-2xl p-5">
            <p className="text-3xl font-bold font-mono text-accent-400">{formatCHF(listing.price_chf)}</p>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <ConditionBadge condition={listing.condition} />
              {listing.grading_company && listing.grading_company !== 'RAW' && (
                <span className="text-xs bg-yellow-950 text-yellow-300 px-2 py-0.5 rounded-full border border-yellow-800 font-medium">
                  {gradingLabel}
                </span>
              )}
              <span className="text-xs text-slate-400">
                <Package size={12} className="inline mr-1" />
                Qty available: {listing.quantity}
              </span>
            </div>
          </div>

          {/* Seller info */}
          <div className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-elevated border border-border flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-slate-300">
                {listing.seller_username?.[0]?.toUpperCase() || '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200">{listing.seller_username}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Star size={12} className="text-yellow-400 fill-yellow-400" />
                <span className="text-xs text-slate-400">Seller rating coming soon</span>
              </div>
            </div>
            <p className="text-xs text-slate-500">Listed {formatDate(listing.created_at)}</p>
          </div>

          {/* Actions */}
          {!isSeller && (
            <div className="flex flex-col gap-3">
              {isAuthenticated ? (
                <>
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={() => setBuying(true)}
                    disabled={!listing.is_available}
                    data-testid="buy-now-btn"
                  >
                    <ShoppingCart size={18} />
                    {listing.is_available ? 'Buy Now' : 'Sold Out'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    className="w-full"
                    onClick={() => setOffering(true)}
                    disabled={!listing.is_available}
                    data-testid="make-offer-btn"
                  >
                    <Tag size={18} />
                    Make an Offer
                  </Button>
                  <button
                    onClick={() => setWatchlisted((w) => !w)}
                    className={`inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm border transition-colors ${
                      watchlisted
                        ? 'border-red-600 text-red-400 bg-red-950/30'
                        : 'border-border text-slate-400 hover:border-slate-600 hover:text-slate-200'
                    }`}
                  >
                    <Heart size={16} className={watchlisted ? 'fill-red-400' : ''} />
                    {watchlisted ? 'Watchlisted' : 'Add to Watchlist'}
                  </button>
                </>
              ) : (
                <Link to="/login">
                  <Button size="lg" className="w-full">Sign in to buy or make offer</Button>
                </Link>
              )}
            </div>
          )}

          {isSeller && (
            <div className="bg-elevated border border-border rounded-xl p-4 text-sm text-slate-400">
              This is your listing. Manage it from{' '}
              <Link to="/dashboard/listings" className="text-accent-400 hover:underline">My Listings</Link>.
            </div>
          )}

          {/* Offer timer info */}
          <div className="flex items-start gap-2 text-xs text-slate-500 bg-elevated rounded-xl px-3 py-2.5">
            <Clock size={13} className="mt-0.5 shrink-0 text-slate-400" />
            <span>Offers expire after 48 hours. Sellers may accept, decline, or counter your offer within that window.</span>
          </div>
        </div>
      </div>

      {buying && (
        <BuyModal listing={listing} card={card} onClose={() => setBuying(false)} />
      )}
      {offering && (
        <OfferModal listing={listing} card={card} onClose={() => setOffering(false)} />
      )}
    </PageContainer>
  )
}
