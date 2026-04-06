'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import useSWR from 'swr'
import {
  ArrowLeft,
  Pencil,
  ShoppingCart,
  Heart,
  ShieldCheck,
  Package,
  AlertTriangle,
  Zap,
  Star,
  Tag,
  User,
  Calendar,
  TrendingUp,
} from 'lucide-react'
import { api, type Listing, type Offer } from '@/lib/api'
import MakeOfferModal from '@/components/listing/MakeOfferModal'
import { formatCHF, formatDate } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/ui/toast'
import Button from '@/components/ui/button'
import Spinner from '@/components/ui/spinner'
import GradingBadge from '@/components/photo/GradingBadge'
import PhotoGallery from '@/components/photo/PhotoGallery'
import SoldPriceSparkline from '@/components/ui/SoldPriceSparkline'

const CONDITION_LABELS: Record<string, string> = {
  MT: 'Mint',
  NM: 'Near Mint',
  LP: 'Lightly Played',
  MP: 'Moderately Played',
  HP: 'Heavily Played',
  DMG: 'Damaged',
}

const CONDITION_COLORS: Record<string, string> = {
  MT: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/25',
  NM: 'text-green-400 bg-green-400/10 border-green-400/25',
  LP: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/25',
  MP: 'text-orange-400 bg-orange-400/10 border-orange-400/25',
  HP: 'text-red-400 bg-red-400/10 border-red-400/25',
  DMG: 'text-red-600 bg-red-600/10 border-red-600/25',
}

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [buying, setBuying] = useState(false)
  const [watchlisting, setWatchlisting] = useState(false)
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [activeOffer, setActiveOffer] = useState<Offer | null>(null)

  const { data: listing, isLoading, error } = useSWR<Listing>(
    id ? `listing-${id}` : null,
    () => api.get<Listing>(`/listings/${id}/`),
  )

  async function addToWatchlist() {
    setWatchlisting(true)
    try {
      await api.post('/watchlist/', { listing: id })
      toast('Added to watchlist', 'success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed'
      toast(msg, 'error')
    } finally {
      setWatchlisting(false)
    }
  }

  async function buyNow() {
    if (!user) {
      toast('Please log in to purchase', 'error')
      return
    }
    setBuying(true)
    try {
      router.push(`/checkout/${id}`)
    } finally {
      setBuying(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error || !listing) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-slate-400">
        <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center">
          <AlertTriangle size={24} className="text-orange-400" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-slate-200">Listing not found</p>
          <p className="text-sm text-slate-500 mt-1">This card may have been sold or removed.</p>
        </div>
        <Link href="/market" className="text-accent-400 hover:text-accent-300 text-sm transition-colors">
          ← Back to marketplace
        </Link>
      </div>
    )
  }

  const isSeller = user?.username === listing.seller_username
  const photos = listing.seller_photo_url ? [listing.seller_photo_url] : []
  const isHighValue = listing.requires_photo
  const hasAutoGrade = listing.grading_status === 'complete' && listing.auto_grade
  const conditionClass = CONDITION_COLORS[listing.condition] ?? 'text-slate-400 bg-slate-400/10 border-slate-400/25'

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back nav */}
      <div className="flex items-center justify-between mb-8">
        <Link
          href="/market"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft size={15} />
          Marketplace
        </Link>
        {isSeller && (
          <Link href={`/market/${listing.id}/edit`}>
            <Button variant="secondary" size="sm">
              <Pencil size={13} /> Edit Listing
            </Button>
          </Link>
        )}
      </div>

      <div className="grid md:grid-cols-5 gap-8 lg:gap-12">
        {/* Left — card image + photos */}
        <div className="md:col-span-2 space-y-4">
          <div className="relative w-full aspect-[5/7] rounded-3xl overflow-hidden border border-border bg-surface shadow-card">
            {/* Subtle inner glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/30 pointer-events-none z-10" />
            <Image
              src={listing.card_image_url || '/placeholder-card.png'}
              alt={listing.card_name}
              fill
              className="object-contain p-4"
              sizes="(max-width: 768px) 100vw, 400px"
              priority
            />
            {isHighValue && (
              <div className="absolute top-3 right-3 z-20">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-400/15 border border-emerald-400/25 px-2.5 py-1 rounded-full backdrop-blur-sm">
                  <ShieldCheck size={11} />
                  Photo Verified
                </span>
              </div>
            )}
          </div>

          {photos.length > 0 && (
            <PhotoGallery
              photos={photos}
              isPhotoVerified={isHighValue && photos.length > 0}
            />
          )}
        </div>

        {/* Right — listing details */}
        <div className="md:col-span-3 space-y-6">
          {/* Title block */}
          <div>
            <div className="flex items-start justify-between gap-3 mb-2">
              <h1 className="text-2xl md:text-3xl font-black text-slate-100 leading-tight">
                {listing.card_name}
              </h1>
              <span className={`shrink-0 mt-1 inline-flex text-xs font-semibold px-2.5 py-1 rounded-lg border ${conditionClass}`}>
                {CONDITION_LABELS[listing.condition] ?? listing.condition}
              </span>
            </div>
            {listing.set_name && (
              <p className="text-slate-400 text-sm">{listing.set_name}</p>
            )}
            {listing.card_rarity && (
              <p className="text-xs text-slate-600 mt-0.5">{listing.card_rarity}</p>
            )}
          </div>

          {/* Price */}
          <div className="bg-surface border border-border rounded-2xl p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Price</p>
            <p className="text-4xl font-black font-mono gradient-text">{formatCHF(listing.price_chf)}</p>
            <p className="text-xs text-slate-600 mt-1">Per card · Swiss Francs</p>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface border border-border rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
                <Package size={11} /> Quantity
              </p>
              <p className="text-sm font-semibold text-slate-200">{listing.quantity}</p>
            </div>
            <div className="bg-surface border border-border rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
                <Star size={11} /> Grading
              </p>
              <p className="text-sm font-semibold text-slate-200">
                {listing.is_graded === 'RAW' ? 'Raw (Ungraded)' : listing.is_graded}
              </p>
            </div>
            <div className="bg-surface border border-border rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
                <User size={11} /> Seller
              </p>
              <p className="text-sm font-semibold text-slate-200">{listing.seller_username}</p>
            </div>
            <div className="bg-surface border border-border rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
                <Calendar size={11} /> Listed
              </p>
              <p className="text-sm font-semibold text-slate-200">{formatDate(listing.created_at)}</p>
            </div>
          </div>

          {/* AI grade panel */}
          {hasAutoGrade && listing.auto_grade && (
            <div className="bg-surface border border-accent-500/20 rounded-2xl px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={14} className="text-accent-400" />
                <p className="text-sm font-semibold text-slate-200">AI Pre-grade</p>
                <span className="ml-auto text-[10px] text-accent-300 bg-accent-500/10 border border-accent-500/20 px-2 py-0.5 rounded-full">
                  Automated
                </span>
              </div>
              <GradingBadge
                condition={listing.auto_grade.grade as Parameters<typeof GradingBadge>[0]['condition']}
                confidence={listing.auto_grade.confidence}
              />
              {listing.auto_grade.confidence > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <TrendingUp size={11} className="text-slate-500" />
                  <div className="flex-1 bg-elevated rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-accent-gradient"
                      style={{ width: `${Math.round(listing.auto_grade.confidence * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    {Math.round(listing.auto_grade.confidence * 100)}%
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Sold price sparkline */}
          <div className="bg-surface border border-border rounded-2xl px-5 py-4">
            <SoldPriceSparkline cardApiId={listing.card_master} days={30} />
          </div>

          {/* CTA */}
          {!isSeller && (
            <div className="flex gap-3 pt-2">
              <Button onClick={buyNow} loading={buying} className="flex-1 shadow-glow-sm hover:shadow-glow-accent">
                <ShoppingCart size={15} />
                Buy Now · {formatCHF(listing.price_chf)}
              </Button>
              <Button variant="secondary" onClick={() => setShowOfferModal(true)}>
                <Tag size={15} />
                Offer
              </Button>
              <Button variant="secondary" onClick={addToWatchlist} loading={watchlisting}>
                <Heart size={15} />
              </Button>
            </div>
          )}

          {isSeller && (
            <div className="bg-elevated border border-border rounded-xl px-4 py-3 text-sm text-slate-400">
              This is your listing. Edit it above to change price or details.
            </div>
          )}
        </div>
      </div>

      {/* Offer modal */}
      {showOfferModal && !isSeller && (
        <MakeOfferModal
          listingId={listing.id}
          listingPrice={listing.price_chf}
          existingOffer={activeOffer}
          onClose={() => setShowOfferModal(false)}
          onSuccess={(offer) => {
            setActiveOffer(offer)
            if (offer.status === 'ACCEPTED') {
              toast('Offer accepted! Proceed to checkout.', 'success')
              setShowOfferModal(false)
            } else if (offer.status === 'DECLINED') {
              toast('Offer declined by seller.', 'error')
              setShowOfferModal(false)
            } else {
              toast('Offer sent!', 'success')
            }
          }}
        />
      )}
    </div>
  )
}
