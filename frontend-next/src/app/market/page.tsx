'use client'

import { useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import Link from 'next/link'
import { Search, SlidersHorizontal, X, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { api, type Listing, type PaginatedResponse } from '@/lib/api'
import ListingCard from '@/components/listing/ListingCard'
import Spinner from '@/components/ui/spinner'

const CONDITIONS = ['MT', 'NM', 'LP', 'MP', 'HP', 'DMG'] as const
const SORT_OPTIONS = [
  { value: '-created_at', label: 'Newest First' },
  { value: 'created_at', label: 'Oldest First' },
  { value: 'price_chf', label: 'Price: Low → High' },
  { value: '-price_chf', label: 'Price: High → Low' },
  { value: 'card_name', label: 'Name A–Z' },
]

function buildPath(search: string, condition: string, sort: string, page: number) {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (condition) params.set('condition', condition)
  if (sort) params.set('ordering', sort)
  params.set('page', String(page))
  params.set('page_size', '24')
  return `/listings/?${params.toString()}`
}

function EmptyState({ search, condition, onClear }: { search: string; condition: string; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-500">
      <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center">
        <Search size={24} className="opacity-40" />
      </div>
      <div className="text-center">
        <p className="font-medium text-slate-300">No listings found</p>
        <p className="text-sm mt-1">
          {search || condition
            ? 'Try adjusting your filters or search term'
            : 'Be the first to list a card!'}
        </p>
      </div>
      {(search || condition) && (
        <button
          onClick={onClear}
          className="text-sm text-accent-400 hover:text-accent-300 transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}

function MarketPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Initialise from URL — handles navbar search and shared links
  const initialSearch = searchParams.get('search') ?? ''
  const [search, setSearch] = useState(initialSearch)
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch)
  const [condition, setCondition] = useState('')
  const [sort, setSort] = useState('-created_at')
  const [page, setPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function syncUrl(nextSearch: string) {
    const p = new URLSearchParams()
    if (nextSearch) p.set('search', nextSearch)
    router.replace(`/market${p.size ? `?${p.toString()}` : ''}`, { scroll: false })
  }

  function handleSearch(val: string) {
    setSearch(val)
    setPage(1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(val)
      syncUrl(val)
    }, 300)
  }

  const swrPath = buildPath(debouncedSearch, condition, sort, page)
  const { data, isLoading } = useSWR(swrPath, () =>
    api.get<PaginatedResponse<Listing> | Listing[]>(swrPath),
  )

  const listings: Listing[] = Array.isArray(data) ? data : (data?.results ?? [])
  const total: number = Array.isArray(data) ? data.length : (data?.count ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / 24))
  const hasFilters = Boolean(debouncedSearch || condition)

  function clearFilters() {
    setSearch('')
    setDebouncedSearch('')
    setCondition('')
    setPage(1)
    router.replace('/market', { scroll: false })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black text-slate-100">Marketplace</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isLoading ? '…' : `${total.toLocaleString()} listing${total !== 1 ? 's' : ''}`}
            {hasFilters && ' matching filters'}
          </p>
        </div>
        <Link
          href="/market/new"
          className="inline-flex items-center gap-2 rounded-xl bg-accent-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow-sm hover:shadow-glow-accent hover:scale-105 transition-all"
        >
          <Plus size={15} /> Sell a Card
        </Link>
      </div>

      {/* Search + Filter bar */}
      <div className="flex gap-2 flex-wrap">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search cards, sets…"
            className="w-full bg-surface border border-border rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent-500/60 focus:ring-1 focus:ring-accent-500/30 transition-colors"
          />
          {search && (
            <button
              onClick={() => handleSearch('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
            showFilters || hasFilters
              ? 'bg-accent-500/15 border-accent-500/30 text-accent-300'
              : 'bg-surface border-border text-slate-400 hover:text-slate-200'
          }`}
        >
          <SlidersHorizontal size={15} />
          Filters
          {hasFilters && (
            <span className="w-1.5 h-1.5 rounded-full bg-accent-400" />
          )}
        </button>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(1) }}
          className="bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-accent-500/60 transition-colors appearance-none cursor-pointer"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className="bg-surface border border-border rounded-2xl p-4 flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Condition</span>
            <div className="flex gap-1.5 flex-wrap">
              {CONDITIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => { setCondition(condition === c ? '' : c); setPage(1) }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    condition === c
                      ? 'bg-accent-500/20 border-accent-500/40 text-accent-300'
                      : 'bg-elevated border-border text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X size={12} /> Clear all
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : listings.length === 0 ? (
        <EmptyState search={debouncedSearch} condition={condition} onClear={clearFilters} />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
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

              <div className="flex gap-1">
                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                  let p: number
                  if (totalPages <= 7) {
                    p = i + 1
                  } else if (page <= 4) {
                    p = i + 1
                  } else if (page >= totalPages - 3) {
                    p = totalPages - 6 + i
                  } else {
                    p = page - 3 + i
                  }
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        page === p
                          ? 'bg-accent-500 text-white'
                          : 'bg-surface border border-border text-slate-400 hover:text-slate-200 hover:border-accent-500/40'
                      }`}
                    >
                      {p}
                    </button>
                  )
                })}
              </div>

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

export default function MarketPage() {
  return (
    <Suspense>
      <MarketPageInner />
    </Suspense>
  )
}
