import Link from 'next/link'
import Image from 'next/image'
import { ShieldCheck, Star, Zap } from 'lucide-react'
import { type Listing } from '@/lib/api'
import { formatCHF } from '@/lib/utils'
import SellerRepBadge from '@/components/ui/seller-rep-badge'

const CONDITION_LABELS: Record<string, string> = {
  MT: 'Mint',
  NM: 'Near Mint',
  LP: 'Lightly Played',
  MP: 'Mod. Played',
  HP: 'Heavily Played',
  DMG: 'Damaged',
}

const CONDITION_COLORS: Record<string, string> = {
  MT: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  NM: 'text-green-400 bg-green-400/10 border-green-400/20',
  LP: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  MP: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  HP: 'text-red-400 bg-red-400/10 border-red-400/20',
  DMG: 'text-red-600 bg-red-600/10 border-red-600/20',
}

export default function ListingCard({ listing }: { listing: Listing }) {
  const conditionClass = CONDITION_COLORS[listing.condition] ?? 'text-slate-400 bg-slate-400/10 border-slate-400/20'
  const conditionLabel = CONDITION_LABELS[listing.condition] ?? listing.condition

  return (
    <Link
      href={`/market/${listing.id}`}
      data-testid="listing-card"
      className="group relative bg-surface border border-border rounded-2xl overflow-hidden card-hover flex flex-col focus-visible:ring-2 focus-visible:ring-accent-500"
    >
      {/* Card image */}
      <div className="relative aspect-[5/7] bg-elevated overflow-hidden">
        <Image
          src={listing.card_image_url || '/placeholder-card.png'}
          alt={listing.card_name}
          fill
          className="object-contain p-3 group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 220px"
        />

        {/* Overlay badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {listing.requires_photo && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded-full backdrop-blur-sm">
              <ShieldCheck size={9} /> Verified
            </span>
          )}
        </div>

        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
          {listing.auto_grade && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-accent-300 bg-accent-500/15 border border-accent-500/25 px-1.5 py-0.5 rounded-full backdrop-blur-sm">
              <Zap size={9} /> AI {listing.auto_grade.grade}
            </span>
          )}
          {listing.is_graded !== 'RAW' && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gold-300 bg-gold-500/10 border border-gold-400/20 px-1.5 py-0.5 rounded-full backdrop-blur-sm">
              <Star size={9} /> {listing.is_graded}
            </span>
          )}
        </div>

        {/* Bottom gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-surface/80 to-transparent pointer-events-none" />
      </div>

      {/* Card info */}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <p className="text-sm font-semibold text-slate-100 truncate leading-tight group-hover:text-accent-300 transition-colors">
          {listing.card_name}
        </p>
        {listing.set_name && (
          <p className="text-xs text-slate-500 truncate">{listing.set_name}</p>
        )}
        <div className="flex items-center justify-between mt-auto pt-1.5">
          <span className={`inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded border ${conditionClass}`}>
            {conditionLabel}
          </span>
          <span className="font-mono text-sm font-bold text-accent-400">
            {formatCHF(listing.price_chf)}
          </span>
        </div>
        {listing.seller_username && (
          <div className="flex items-center justify-between gap-1">
            <p className="text-[10px] text-slate-600 truncate">by {listing.seller_username}</p>
            <SellerRepBadge
              score={listing.seller_reputation_score}
              totalReviews={listing.seller_reputation_count}
            />
          </div>
        )}
      </div>
    </Link>
  )
}
