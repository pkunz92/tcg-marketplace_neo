import { useSearchParams } from 'react-router-dom'
import { useInView } from 'react-intersection-observer'
import { useEffect } from 'react'
import { useListingsInfinite } from '../hooks/useListings'
import ListingCard from '../components/marketplace/ListingCard'
import SearchInput from '../components/catalog/SearchInput'
import PageContainer from '../components/layout/PageContainer'
import Spinner from '../components/ui/Spinner'
import { ShoppingBag } from 'lucide-react'
import EmptyState from '../components/ui/EmptyState'

export default function MarketplacePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('search') || ''
  const condition = searchParams.get('condition') || ''

  const params = {}
  if (search) params.search = search
  if (condition) params.condition = condition

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useListingsInfinite(params)

  const { ref, inView } = useInView({ threshold: 0.1 })

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  const allListings = data?.pages.flatMap((p) => p.results || []) || []

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Marketplace</h1>
          <p className="text-sm text-slate-400 mt-0.5">Browse cards for sale from community sellers</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <SearchInput
          value={search}
          onChange={(v) => setSearchParams(v ? { search: v } : {})}
          placeholder="Search listings…"
          className="flex-1"
        />
        <select
          value={condition}
          onChange={(e) => setSearchParams((p) => { const n = new URLSearchParams(p); e.target.value ? n.set('condition', e.target.value) : n.delete('condition'); return n })}
          className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-accent-500"
        >
          <option value="">All conditions</option>
          {['MT','NM','LP','MP','HP','DMG'].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : allListings.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="No listings found" description="Be the first to list a card for sale!" />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {allListings.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
          <div ref={ref} className="flex justify-center py-8">
            {isFetchingNextPage && <Spinner />}
          </div>
        </>
      )}
    </PageContainer>
  )
}
