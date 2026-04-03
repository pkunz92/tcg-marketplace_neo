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
} from 'lucide-react'
import { api, type Listing } from '@/lib/api'
import { formatCHF, formatDate } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/ui/toast'
import Button from '@/components/ui/button'
import Spinner from '@/components/ui/spinner'
import GradingBadge from '@/components/photo/GradingBadge'
import PhotoGallery from '@/components/photo/PhotoGallery'

const CONDITION_LABELS: Record<string, string> = {
  MT: 'Mint',
  NM: 'Near Mint',
  LP: 'Lightly Played',
  MP: 'Moderately Played',
  HP: 'Heavily Played',
  DMG: 'Damaged',
}

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [buying, setBuying] = useState(false)
  const [watchlisting, setWatchlisting] = useState(false)

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
      <main className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </main>
    )
  }

  if (error || !listing) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 text-slate-400">
        <AlertTriangle size={36} />
        <p>Listing not found.</p>
        <Link href="/" className="text-accent-400 hover:underline text-sm">
          Back to marketplace
        </Link>
      </main>
    )
  }

  const isSeller = user?.username === listing.seller_username
  const photos = listing.seller_photo_url ? [listing.seller_photo_url] : []
  const isHighValue = listing.requires_photo
  const hasAutoGrade =
    listing.grading_status === 'complete' && listing.auto_grade

  return (
    <main className="min-h-screen px-4 py-8 max-w-4xl mx-auto">
      {/* Back nav */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="flex items-center gap-2 text-slate-500 hover:text-slate-200 transition-colors text-sm">
          <ArrowLeft size={16} />
          Marketplace
        </Link>
        {isSeller && (
          <Link href={`/market/${listing.id}/edit`}>
            <Button variant="secondary" size="sm">
              <Pencil size={13} /> Edit
            </Button>
          </Link>
        )}
      </div>

      <div className="grid md:grid-cols-5 gap-8">
        {/* Left — card image + photos */}
        <div className="md:col-span-2 space-y-4">
          <div className="relative w-full aspect-[5/7] rounded-2xl overflow-hidden border border-border bg-surface">
            <Image
              src={listing.card_image_url || '/placeholder-card.png'}
              alt={listing.card_name}
              fill
              className="object-contain p-3"
              sizes="(max-width: 768px) 100vw, 400px"
              priority
            />
            {isHighValue && (
              <div className="absolute top-2 right-2">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full">
                  <ShieldCheck size={11} />
                  Photo verified
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
        <div className="md:col-span-3 space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">{listing.card_name}</h1>
            {listing.set_name && (
              <p className="text-slate-400 text-sm mt-1">{listing.set_name}</p>
            )}
            {listing.card_rarity && (
              <p className="text-xs text-slate-500 mt-0.5">{listing.card_rarity}</p>
            )}
          </div>

          {/* Price */}
          <div className="text-3xl font-mono font-bold text-accent-400">
            {formatCHF(listing.price_chf)}
          </div>

          {/* Condition + grading */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface border border-border rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Condition</p>
              <p className="text-sm font-medium text-slate-200">
                {CONDITION_LABELS[listing.condition] ?? listing.condition}
              </p>
            </div>
            <div className="bg-surface border border-border rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Grading</p>
              <p className="text-sm font-medium text-slate-200">
                {listing.is_graded === 'RAW' ? 'Raw (Ungraded)' : listing.is_graded}
              </p>
            </div>
          </div>

          {/* AI confidence badge */}
          {hasAutoGrade && listing.auto_grade && (
            <div className="bg-surface border border-border rounded-xl px-4 py-3 space-y-2">
              <p className="text-xs text-slate-500">AI Pre-grade</p>
              <GradingBadge
                condition={listing.auto_grade.grade as Parameters<typeof GradingBadge>[0]['condition']}
                confidence={listing.auto_grade.confidence}
              />
            </div>
          )}

          {/* Meta */}
          <div className="flex flex-wrap gap-4 text-sm text-slate-400">
            <span className="flex items-center gap-1.5">
              <Package size={13} />
              Qty: {listing.quantity}
            </span>
            <span>Seller: <span className="text-slate-300">{listing.seller_username}</span></span>
            <span>Listed: {formatDate(listing.created_at)}</span>
          </div>

          {/* CTA */}
          {!isSeller && (
            <div className="flex gap-3 pt-2">
              <Button onClick={buyNow} loading={buying} className="flex-1">
                <ShoppingCart size={16} />
                Buy Now
              </Button>
              <Button variant="secondary" onClick={addToWatchlist} loading={watchlisting}>
                <Heart size={16} />
                Watchlist
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
