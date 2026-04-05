'use client'

import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import useSWR from 'swr'
import {
  ArrowLeft,
  ShoppingCart,
  Tag,
  Layers,
  AlertTriangle,
  TrendingUp,
  BarChart2,
  ShieldCheck,
  Zap,
  Star,
} from 'lucide-react'
import { api, type CardWithStats, type Listing } from '@/lib/api'
import { formatCHF, formatDate } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import Button from '@/components/ui/button'
import Spinner from '@/components/ui/spinner'

const CONDITION_LABELS: Record<string, string> = {
  MT: 'Mint', NM: 'Near Mint', LP: 'Lightly Played',
  MP: 'Mod. Played', HP: 'Heavily Played', DMG: 'Damaged',
}
const CONDITION_COLORS: Record<string, string> = {
  MT: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/25',
  NM: 'text-green-400 bg-green-400/10 border-green-400/25',
  LP: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/25',
  MP: 'text-orange-400 bg-orange-400/10 border-orange-400/25',
  HP: 'text-red-400 bg-red-400/10 border-red-400/25',
  DMG: 'text-red-600 bg-red-600/10 border-red-600/25',
}

function ListingRow({ listing }: { listing: Listing }) {
  const { user } = useAuth()
  const isSeller = user?.username === listing.seller_username
  const conditionClass = CONDITION_COLORS[listing.condition] ?? 'text-slate-400 bg-slate-400/10 border-slate-400/25'

  return (
    <div className="flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3 hover:border-accent-500/30 transition-colors">
      {/* Condition */}
      <span className={`shrink-0 inline-flex text-[10px] font-semibold px-2 py-0.5 rounded border ${conditionClass}`}>
        {CONDITION_LABELS[listing.condition] ?? listing.condition}
      </span>

      {/* Grading */}
      {listing.is_graded !== 'RAW' && (
        <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-gold-300 bg-gold-500/10 border border-gold-400/20 px-1.5 py-0.5 rounded">
          <Star size={9} /> {listing.is_graded}
        </span>
      )}

      {/* Verified */}
      {listing.requires_photo && (
        <span className="shrink-0 hidden sm:inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded">
          <ShieldCheck size={9} /> Verified
        </span>
      )}

      {/* AI Grade */}
      {listing.auto_grade && (
        <span className="shrink-0 hidden sm:inline-flex items-center gap-1 text-[10px] font-medium text-accent-300 bg-accent-500/10 border border-accent-500/20 px-1.5 py-0.5 rounded">
          <Zap size={9} /> {listing.auto_grade.grade}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-400 truncate">
          by <span className="text-slate-300 font-medium">{listing.seller_username}</span>
          {listing.quantity > 1 && <span className="ml-2 text-slate-600">Qty: {listing.quantity}</span>}
        </p>
        <p className="text-[10px] text-slate-600">{formatDate(listing.created_at)}</p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className="font-mono font-bold text-accent-400">{formatCHF(listing.price_chf)}</span>
        {!isSeller && (
          <Link href={`/checkout/${listing.id}`}>
            <Button size="sm">
              <ShoppingCart size={13} /> Buy
            </Button>
          </Link>
        )}
        {isSeller && (
          <Link href={`/market/${listing.id}/edit`}>
            <Button size="sm" variant="secondary">Edit</Button>
          </Link>
        )}
      </div>
    </div>
  )
}

export default function CardDetailPage() {
  const { apiId } = useParams<{ apiId: string }>()

  const { data, isLoading, error } = useSWR<CardWithStats>(
    apiId ? `card-stats-${apiId}` : null,
    () => api.get<CardWithStats>(`/cards/${apiId}/stats/`),
  )

  const router = useRouter()

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-slate-400">
        <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center">
          <AlertTriangle size={24} className="text-orange-400" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-slate-200">Card not found</p>
          <p className="text-sm text-slate-500 mt-1">This card could not be found in the catalog.</p>
        </div>
        <button onClick={() => router.back()} className="text-accent-400 hover:text-accent-300 text-sm transition-colors">
          ← Go back
        </button>
      </div>
    )
  }

  const { card, listings, statistics } = data
  const hasListings = listings.length > 0

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back */}
      <Link href="/cards" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-200 transition-colors mb-8">
        <ArrowLeft size={15} /> Card Catalog
      </Link>

      <div className="grid md:grid-cols-5 gap-8 lg:gap-12 mb-12">
        {/* Left — card image */}
        <div className="md:col-span-2">
          <div className="relative w-full aspect-[5/7] rounded-3xl overflow-hidden border border-border bg-surface shadow-card">
            {card.image_url ? (
              <Image
                src={card.image_url}
                alt={card.card_name}
                fill
                className="object-contain p-4"
                sizes="(max-width: 768px) 100vw, 400px"
                priority
                unoptimized={card.image_url.startsWith('http://') || card.image_url.includes('localhost')}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Layers size={48} className="text-slate-700" />
              </div>
            )}
          </div>
        </div>

        {/* Right — card details */}
        <div className="md:col-span-3 space-y-5">
          {/* Title */}
          <div>
            <h1 className="text-3xl font-black text-slate-100 leading-tight mb-1">{card.card_name}</h1>
            <p className="text-slate-400 text-sm">{card.set?.set_name ?? '—'}</p>
            {card.card_rarity && (
              <p className="text-xs text-slate-600 mt-0.5">{card.card_rarity}</p>
            )}
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3">
            {card.card_number && (
              <div className="bg-surface border border-border rounded-xl px-4 py-3">
                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1.5"><Tag size={11} /> Number</p>
                <p className="text-sm font-semibold text-slate-200">#{card.card_number}</p>
              </div>
            )}
            {card.supertype && (
              <div className="bg-surface border border-border rounded-xl px-4 py-3">
                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1.5"><Layers size={11} /> Type</p>
                <p className="text-sm font-semibold text-slate-200">{card.supertype}</p>
              </div>
            )}
            {card.hp && (
              <div className="bg-surface border border-border rounded-xl px-4 py-3">
                <p className="text-xs text-slate-500 mb-1">HP</p>
                <p className="text-sm font-bold text-red-400">{card.hp}</p>
              </div>
            )}
            {card.types && card.types.length > 0 && (
              <div className="bg-surface border border-border rounded-xl px-4 py-3">
                <p className="text-xs text-slate-500 mb-1">Energy Type</p>
                <p className="text-sm font-semibold text-slate-200">{card.types.join(', ')}</p>
              </div>
            )}
            {card.artist && (
              <div className="bg-surface border border-border rounded-xl px-4 py-3 col-span-2">
                <p className="text-xs text-slate-500 mb-1">Illustrator</p>
                <p className="text-sm font-semibold text-slate-200">{card.artist}</p>
              </div>
            )}
          </div>

          {/* Price stats (from active listings) */}
          {hasListings ? (
            <div className="bg-surface border border-accent-500/20 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 size={14} className="text-accent-400" />
                <p className="text-sm font-semibold text-slate-200">Marketplace Prices</p>
                <span className="ml-auto text-xs text-slate-500">{statistics.total_listings} listing{statistics.total_listings !== 1 ? 's' : ''}</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'From', value: statistics.min_price },
                  { label: 'Average', value: statistics.avg_price },
                  { label: 'Up to', value: statistics.max_price },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <p className="text-xs text-slate-500 mb-1">{label}</p>
                    <p className="font-mono font-bold text-accent-400">
                      {value != null ? formatCHF(value) : '—'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-2xl p-5 text-center">
              <TrendingUp size={24} className="mx-auto mb-2 text-slate-600" />
              <p className="text-sm text-slate-400 font-medium">No active listings</p>
              <p className="text-xs text-slate-600 mt-1">Be the first to sell this card</p>
              <Link
                href={`/market/new`}
                className="inline-flex items-center gap-2 mt-4 rounded-xl bg-accent-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow-sm hover:shadow-glow-accent transition-all"
              >
                <ShoppingCart size={13} /> List for Sale
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Listings section */}
      {hasListings && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-100">Active Listings</h2>
            <Link
              href={`/market/new`}
              className="inline-flex items-center gap-2 rounded-xl bg-accent-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow-sm hover:shadow-glow-accent transition-all"
            >
              <ShoppingCart size={13} /> Sell This Card
            </Link>
          </div>
          <div className="space-y-2">
            {listings.map((l) => (
              <ListingRow key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
