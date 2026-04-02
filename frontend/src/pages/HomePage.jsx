import { Link } from 'react-router-dom'
import { Search, ShoppingBag, Zap, Database, Globe, TrendingUp } from 'lucide-react'
import { useDbStats } from '../hooks/useDbStats'
import { useListings } from '../hooks/useListings'
import { useSets } from '../hooks/useSets'
import Button from '../components/ui/Button'
import ListingCard from '../components/marketplace/ListingCard'
import Skeleton from '../components/ui/Skeleton'

function HeroStat({ value, label }) {
  return (
    <div className="text-center">
      <p className="text-3xl font-bold text-accent-400 font-mono">{value}</p>
      <p className="text-sm text-slate-400 mt-1">{label}</p>
    </div>
  )
}

function SetCard({ set }) {
  return (
    <Link
      to={`/cards?set_code=${set.set_code}`}
      className="bg-surface border border-border rounded-xl p-4 flex flex-col items-center gap-3 hover:border-accent-500/40 transition-colors group"
    >
      {set.logo_url ? (
        <img src={set.logo_url} alt={set.set_name} className="h-8 object-contain group-hover:scale-105 transition-transform" />
      ) : (
        <div className="h-8 flex items-center">
          <span className="text-xs text-slate-400 text-center">{set.set_name}</span>
        </div>
      )}
      <div className="text-center">
        <p className="text-xs font-medium text-slate-300 truncate w-full">{set.set_name}</p>
        <p className="text-xs text-slate-500">{set.total_cards} cards</p>
      </div>
    </Link>
  )
}

export default function HomePage() {
  const { data: stats } = useDbStats()
  const { data: listingsData, isLoading: listingsLoading } = useListings({ page: 1 })
  const { data: setsData } = useSets({ page: 1 })

  const recentListings = listingsData?.results?.slice(0, 6) || []
  const sets = setsData?.results || setsData || []
  const featuredSets = sets.slice(0, 8)

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-accent-500/5 via-transparent to-blue-500/5 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-accent-500/10 border border-accent-500/30 rounded-full px-4 py-1.5 text-sm text-accent-400 mb-6">
            <Zap size={14} /> The Pokemon TCG Marketplace
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-bold text-slate-100 mb-4 leading-tight">
            Buy & Sell Pokemon<br />
            <span className="text-accent-400">Cards</span> With Confidence
          </h1>
          <p className="text-lg text-slate-400 max-w-xl mx-auto mb-8">
            Browse 20,000+ cards from every era. Find the card you need at the best price.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/cards">
              <Button size="lg"><Search size={18} /> Browse Cards</Button>
            </Link>
            <Link to="/market">
              <Button variant="secondary" size="lg"><ShoppingBag size={18} /> Marketplace</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      {stats && (
        <section className="border-b border-border bg-surface">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
            <HeroStat value={stats.total_cards?.toLocaleString() || '20K+'} label="Cards in database" />
            <HeroStat value={stats.total_sets?.toLocaleString() || '172'} label="Sets covered" />
            <HeroStat value={stats.supertypes?.['Pokémon']?.toLocaleString() || '—'} label="Pokémon cards" />
            <HeroStat value="CHF" label="Swiss Franc pricing" />
          </div>
        </section>
      )}

      {/* Recent listings */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Recent Listings</h2>
            <p className="text-sm text-slate-400 mt-0.5">Freshly listed cards from the community</p>
          </div>
          <Link to="/market" className="text-sm text-accent-500 hover:text-accent-400 transition-colors">
            View all →
          </Link>
        </div>
        {listingsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="aspect-[63/88] rounded-xl" />
                <Skeleton className="mt-2 h-3 w-3/4 rounded" />
              </div>
            ))}
          </div>
        ) : recentListings.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <ShoppingBag size={32} className="mx-auto mb-3 opacity-40" />
            <p>No listings yet — be the first to sell!</p>
            <Link to="/register" className="text-accent-500 hover:underline text-sm mt-2 inline-block">Create account to list cards</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {recentListings.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        )}
      </section>

      {/* Featured sets */}
      <section className="border-t border-border bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-100">Explore Sets</h2>
              <p className="text-sm text-slate-400 mt-0.5">All eras, Base Set to Scarlet & Violet</p>
            </div>
            <Link to="/cards" className="text-sm text-accent-500 hover:text-accent-400">
              All {stats?.total_sets || 172} sets →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
            {featuredSets.map((s) => <SetCard key={s.set_code} set={s} />)}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="bg-gradient-to-r from-accent-500/10 via-elevated to-blue-500/10 border border-border rounded-2xl p-10">
          <Globe size={32} className="text-accent-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Start Selling Today</h2>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            List your cards in seconds. Reach buyers looking for exactly what you have.
          </p>
          <Link to="/register">
            <Button size="lg">Create Free Account</Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
