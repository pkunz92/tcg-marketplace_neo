'use client'

import Link from 'next/link'
import Image from 'next/image'
import useSWR from 'swr'
import { ArrowRight, ShieldCheck, Zap, Globe, TrendingUp, Star } from 'lucide-react'
import { api, type Listing, type PaginatedResponse } from '@/lib/api'
import { formatCHF } from '@/lib/utils'

const CONDITION_COLORS: Record<string, string> = {
  MT: 'text-emerald-400',
  NM: 'text-green-400',
  LP: 'text-yellow-400',
  MP: 'text-orange-400',
  HP: 'text-red-400',
  DMG: 'text-red-600',
}

const TRUST_FEATURES = [
  { icon: ShieldCheck, label: 'Photo Verified', desc: 'Every high-value card verified with seller photos' },
  { icon: Zap, label: 'Instant AI Grading', desc: 'Automated pre-grade on upload — no guessing' },
  { icon: Globe, label: 'Worldwide Shipping', desc: 'Secure delivery tracked end-to-end' },
  { icon: TrendingUp, label: 'Live Pricing', desc: 'Market-based pricing updated in real time' },
]

function FeaturedCard({ listing }: { listing: Listing }) {
  const conditionColor = CONDITION_COLORS[listing.condition] ?? 'text-slate-400'
  return (
    <Link
      href={`/market/${listing.id}`}
      className="group relative bg-surface border border-border rounded-2xl overflow-hidden card-hover flex flex-col"
    >
      {/* Image area */}
      <div className="relative aspect-[5/7] bg-elevated overflow-hidden">
        <Image
          src={listing.card_image_url || '/placeholder-card.png'}
          alt={listing.card_name}
          fill
          className="object-contain p-3 group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
        />
        {listing.requires_photo && (
          <div className="absolute top-2 left-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded-full">
              <ShieldCheck size={9} /> Verified
            </span>
          </div>
        )}
        {listing.auto_grade && (
          <div className="absolute top-2 right-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-accent-300 bg-accent-500/15 border border-accent-500/25 px-1.5 py-0.5 rounded-full">
              <Star size={9} /> AI Graded
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1.5">
        <p className="text-sm font-semibold text-slate-100 truncate leading-tight">{listing.card_name}</p>
        {listing.set_name && (
          <p className="text-xs text-slate-500 truncate">{listing.set_name}</p>
        )}
        <div className="flex items-center justify-between mt-1">
          <span className={`text-xs font-medium ${conditionColor}`}>{listing.condition}</span>
          <span className="font-mono text-sm font-bold text-accent-400">{formatCHF(listing.price_chf)}</span>
        </div>
      </div>
    </Link>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden flex flex-col">
      <div className="aspect-[5/7] skeleton" />
      <div className="p-3 space-y-2">
        <div className="h-3.5 skeleton rounded w-3/4" />
        <div className="h-3 skeleton rounded w-1/2" />
        <div className="h-3 skeleton rounded w-1/3" />
      </div>
    </div>
  )
}

export default function HomePage() {
  const { data, isLoading } = useSWR('featured-listings', () =>
    api.get<PaginatedResponse<Listing> | Listing[]>('/listings/?ordering=-created_at&page_size=8'),
  )
  const listings: Listing[] = Array.isArray(data) ? data.slice(0, 8) : (data?.results?.slice(0, 8) ?? [])

  return (
    <div className="flex flex-col gap-20 pb-16">

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="hero-bg -mx-4 px-4 pt-16 pb-20 text-center relative overflow-hidden">
        {/* decorative blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 left-1/4 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl" />
          <div className="absolute top-10 right-1/4 w-64 h-64 bg-violet-500/8 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-accent-500/10 border border-accent-500/20 rounded-full px-4 py-1.5 text-xs font-medium text-accent-300 mb-6">
            <Zap size={12} />
            AI-powered card grading · Live marketplace
          </div>

          <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-[1.1] mb-6">
            <span className="text-slate-50">The premium</span>{' '}
            <span className="gradient-text">Pokémon TCG</span>
            <br />
            <span className="text-slate-50">marketplace</span>
          </h1>

          <p className="text-lg text-slate-400 max-w-xl mx-auto mb-8 leading-relaxed">
            Buy and sell Pokémon cards with instant AI grading, photo verification,
            and secure worldwide shipping.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/market"
              className="inline-flex items-center gap-2 rounded-xl bg-accent-gradient px-6 py-3 font-semibold text-white shadow-glow-accent hover:shadow-glow-accent transition-all hover:scale-105 active:scale-100"
            >
              Browse Market <ArrowRight size={16} />
            </Link>
            <Link
              href="/market/new"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-elevated px-6 py-3 font-semibold text-slate-200 hover:border-accent-500/40 hover:text-white transition-all"
            >
              Sell a Card
            </Link>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap items-center justify-center gap-8 mt-12 text-center">
            {[
              { value: '50,000+', label: 'Cards Listed' },
              { value: '12,000+', label: 'Trades Completed' },
              { value: '99.8%', label: 'Buyer Satisfaction' },
              { value: '24h', label: 'Avg. Ship Time' },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-2xl font-black gradient-text-gold stat-value">{s.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Listings ──────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Latest Listings</h2>
            <p className="text-sm text-slate-500 mt-0.5">Fresh cards just added to the market</p>
          </div>
          <Link
            href="/market"
            className="inline-flex items-center gap-1.5 text-sm text-accent-400 hover:text-accent-300 font-medium transition-colors"
          >
            View all <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
            : listings.length > 0
              ? listings.map((l) => <FeaturedCard key={l.id} listing={l} />)
              : Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          }
        </div>
      </section>

      {/* ── Trust features ─────────────────────────────────────────── */}
      <section>
        <h2 className="text-xl font-bold text-slate-100 text-center mb-8">
          Built for serious collectors
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TRUST_FEATURES.map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3 hover:border-accent-500/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-accent-500/15 border border-accent-500/20 flex items-center justify-center">
                <Icon size={18} className="text-accent-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-100 text-sm">{label}</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA banner ─────────────────────────────────────────────── */}
      <section className="relative rounded-3xl overflow-hidden bg-surface border border-border p-10 text-center">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-accent-500/10 via-transparent to-violet-500/8" />
        </div>
        <div className="relative">
          <h2 className="text-3xl font-black text-slate-100 mb-3">Ready to sell your collection?</h2>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            List a card in under 2 minutes. Our AI handles grading — you just set the price.
          </p>
          <Link
            href="/market/new"
            className="inline-flex items-center gap-2 rounded-xl bg-accent-gradient px-8 py-3 font-semibold text-white shadow-glow-accent hover:scale-105 transition-all"
          >
            Start Selling <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  )
}
