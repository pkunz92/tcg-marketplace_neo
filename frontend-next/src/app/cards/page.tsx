'use client'

import { useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import useSWR from 'swr'
import { Search, X, ChevronLeft, ChevronRight, Layers, Zap } from 'lucide-react'
import { api, type CardMaster, type PaginatedResponse } from '@/lib/api'
import Spinner from '@/components/ui/spinner'

const SUPERTYPES = ['Pokémon', 'Trainer', 'Energy']
const TCG_TYPES = [
  { value: 'pokemon', label: 'Pokémon' },
  { value: 'yugioh', label: 'Yu-Gi-Oh!' },
  { value: 'mtg', label: 'Magic: TG' },
  { value: 'sports', label: 'Sports' },
]

const RARITY_COLORS: Record<string, string> = {
  Common: 'text-slate-400',
  Uncommon: 'text-green-400',
  Rare: 'text-blue-400',
  'Rare Holo': 'text-violet-400',
  'Rare Ultra': 'text-yellow-400',
  'Rare Secret': 'text-orange-400',
  'Rare Rainbow': 'text-pink-400',
  'Amazing Rare': 'text-emerald-400',
  Promo: 'text-accent-400',
}

function buildPath(search: string, supertype: string, tcgType: string, page: number) {
  const p = new URLSearchParams()
  if (search) p.set('search', search)
  if (supertype) p.set('supertype', supertype)
  if (tcgType) p.set('tcg_type', tcgType)
  p.set('page', String(page))
  p.set('page_size', '48')
  return `/cards/list/?${p.toString()}`
}

function CardThumbnail({ card }: { card: CardMaster }) {
  const rarityColor = card.card_rarity ? (RARITY_COLORS[card.card_rarity] ?? 'text-slate-500') : 'text-slate-500'

  return (
    <Link
      href={`/cards/${card.api_id}`}
      className="group relative bg-surface border border-border rounded-2xl overflow-hidden card-hover flex flex-col"
    >
      {/* Card image */}
      <div className="relative aspect-[5/7] bg-elevated overflow-hidden">
        {card.image_url ? (
          <Image
            src={card.image_url}
            alt={card.card_name}
            fill
            className="object-contain p-2 group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
            unoptimized={card.image_url.startsWith('http://') || card.image_url.includes('localhost')}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Layers size={32} className="text-slate-700" />
          </div>
        )}

        {/* Number badge */}
        {card.card_number && (
          <div className="absolute bottom-2 left-2">
            <span className="text-[10px] font-mono text-slate-400 bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm">
              #{card.card_number}
            </span>
          </div>
        )}
      </div>

      {/* Card info */}
      <div className="p-2.5 flex flex-col gap-1">
        <p className="text-xs font-semibold text-slate-100 truncate leading-tight group-hover:text-accent-300 transition-colors">
          {card.card_name}
        </p>
        <p className="text-[10px] text-slate-500 truncate">{card.set?.set_name ?? '—'}</p>
        {card.card_rarity && (
          <p className={`text-[10px] font-medium truncate ${rarityColor}`}>{card.card_rarity}</p>
        )}
      </div>
    </Link>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">
      <div className="aspect-[5/7] skeleton" />
      <div className="p-2.5 space-y-1.5">
        <div className="h-3 skeleton rounded w-4/5" />
        <div className="h-2.5 skeleton rounded w-3/5" />
      </div>
    </div>
  )
}

function CardsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialSearch = searchParams.get('search') ?? ''

  const [search, setSearch] = useState(initialSearch)
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch)
  const [supertype, setSupertype] = useState('')
  const [tcgType, setTcgType] = useState('')
  const [page, setPage] = useState(1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleSearch(val: string) {
    setSearch(val)
    setPage(1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(val)
      const p = new URLSearchParams()
      if (val) p.set('search', val)
      router.replace(`/cards${p.size ? `?${p.toString()}` : ''}`, { scroll: false })
    }, 300)
  }

  const swrPath = buildPath(debouncedSearch, supertype, tcgType, page)
  const { data, isLoading } = useSWR(swrPath, () =>
    api.get<PaginatedResponse<CardMaster> | CardMaster[]>(swrPath),
  )

  const cards: CardMaster[] = Array.isArray(data) ? data : (data?.results ?? [])
  const total: number = Array.isArray(data) ? data.length : (data?.count ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / 48))
  const hasFilters = Boolean(debouncedSearch || supertype || tcgType)

  function clearFilters() {
    setSearch('')
    setDebouncedSearch('')
    setSupertype('')
    setTcgType('')
    setPage(1)
    router.replace('/cards', { scroll: false })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black text-slate-100">Card Catalog</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isLoading ? '…' : `${total.toLocaleString()} card${total !== 1 ? 's' : ''}`}
            {hasFilters && ' matching filters'}
          </p>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col gap-3">
        {/* Search bar */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by card name or number…"
            className="w-full bg-surface border border-border rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent-500/60 focus:ring-1 focus:ring-accent-500/30 transition-colors"
          />
          {search && (
            <button onClick={() => handleSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Supertype filters */}
          <div className="flex gap-1.5 flex-wrap">
            {SUPERTYPES.map((s) => (
              <button
                key={s}
                onClick={() => { setSupertype(supertype === s ? '' : s); setPage(1) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  supertype === s
                    ? 'bg-accent-500/20 border-accent-500/40 text-accent-300'
                    : 'bg-surface border-border text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-border hidden sm:block" />

          {/* TCG type filters */}
          <div className="flex gap-1.5 flex-wrap">
            {TCG_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => { setTcgType(tcgType === t.value ? '' : t.value); setPage(1) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  tcgType === t.value
                    ? 'bg-accent-500/20 border-accent-500/40 text-accent-300'
                    : 'bg-surface border-border text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Results grid */}
      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {Array.from({ length: 48 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-500">
          <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center">
            <Layers size={24} className="opacity-40" />
          </div>
          <div className="text-center">
            <p className="font-medium text-slate-300">No cards found</p>
            <p className="text-sm mt-1">Try a different search or clear filters</p>
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="text-sm text-accent-400 hover:text-accent-300 transition-colors">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {cards.map((card) => (
              <CardThumbnail key={card.api_id} card={card} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-border bg-surface text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>

              <span className="text-sm text-slate-400 px-2">
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-border bg-surface text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function CardsPage() {
  return (
    <Suspense>
      <CardsPageInner />
    </Suspense>
  )
}
