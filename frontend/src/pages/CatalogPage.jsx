import { useSearchParams } from 'react-router-dom'
import { LayoutGrid, List, SlidersHorizontal, X } from 'lucide-react'
import { useState } from 'react'
import { useCardsInfinite } from '../hooks/useCards'
import { useDebounce } from '../hooks/useDebounce'
import CardGrid from '../components/cards/CardGrid'
import CardListView from '../components/cards/CardListView'
import FilterSidebar from '../components/catalog/FilterSidebar'
import SearchInput from '../components/catalog/SearchInput'
import SortSelector from '../components/catalog/SortSelector'
import Spinner from '../components/ui/Spinner'
import PageContainer from '../components/layout/PageContainer'

function buildParams(searchParams) {
  const p = {}
  for (const [k, v] of searchParams.entries()) {
    if (v && k !== 'view') p[k] = v
  }
  return p
}

export default function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const search   = searchParams.get('search') || ''
  const ordering = searchParams.get('ordering') || ''
  const view     = searchParams.get('view') || 'grid'
  const language = searchParams.get('language') || 'en'
  const debouncedSearch = useDebounce(search, 300)

  const params = {
    ...buildParams(searchParams),
    search: debouncedSearch,
    ordering,
    language,
  }
  Object.keys(params).forEach((k) => { if (!params[k] && params[k] !== 0) delete params[k] })

  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useCardsInfinite(params)

  const cards      = data?.pages.flatMap((p) => p.results) || []
  const totalCount = data?.pages[0]?.count || 0

  function updateParam(updates) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      Object.entries(updates).forEach(([k, v]) => {
        if (v) next.set(k, v)
        else next.delete(k)
      })
      return next
    })
  }

  function resetFilters() {
    setSearchParams(view !== 'grid' ? { view } : {})
  }

  const filterValues = {
    series:    searchParams.get('series') || '',
    supertype: searchParams.get('supertype') || '',
    rarity:   searchParams.get('rarity') || '',
    types:    searchParams.get('types') || '',
    set_code: searchParams.get('set_code') || '',
    hp_min:   searchParams.get('hp_min') || '',
    hp_max:   searchParams.get('hp_max') || '',
    has_price: searchParams.get('has_price') || '',
  }

  const activeFilters = Object.entries(filterValues).filter(([, v]) => !!v)

  const FILTER_LABELS = {
    series: 'Era', supertype: 'Type', rarity: 'Rarity', types: 'Energy',
    set_code: 'Set', hp_min: 'Min HP', hp_max: 'Max HP', has_price: 'Has Price',
  }

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Card Catalog</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {totalCount > 0 ? `${totalCount.toLocaleString()} cards` : 'Browse all Pokémon TCG cards'}
          </p>
        </div>
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="md:hidden flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-slate-300 hover:bg-elevated"
        >
          <SlidersHorizontal size={15} /> Filters
          {activeFilters.length > 0 && (
            <span className="w-5 h-5 bg-accent-500 text-base rounded-full text-xs flex items-center justify-center font-bold">
              {activeFilters.length}
            </span>
          )}
        </button>
      </div>

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {activeFilters.map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center gap-1.5 text-xs bg-elevated border border-border rounded-full px-3 py-1 text-slate-300"
            >
              <span className="text-slate-500">{FILTER_LABELS[k] || k}:</span> {v}
              <button onClick={() => updateParam({ [k]: '' })} className="text-slate-500 hover:text-slate-200">
                <X size={11} />
              </button>
            </span>
          ))}
          <button
            onClick={resetFilters}
            className="text-xs text-accent-500 hover:text-accent-400 px-2"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6">
        <SearchInput
          value={search}
          onChange={(v) => updateParam({ search: v })}
          className="flex-1"
        />
        <SortSelector value={ordering} onChange={(v) => updateParam({ ordering: v })} />
        {/* Language selector */}
        <select
          value={language}
          onChange={(e) => updateParam({ language: e.target.value, series: '', set_code: '', rarity: '' })}
          className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-accent-500 shrink-0"
          title="Card language"
        >
          <option value="en">🇬🇧 EN</option>
          <option value="ja">🇯🇵 JA</option>
          <option value="de">🇩🇪 DE</option>
          <option value="fr">🇫🇷 FR</option>
          <option value="it">🇮🇹 IT</option>
          <option value="zh-cn">🇨🇳 ZH</option>
        </select>
        {/* View toggle */}
        <div className="flex items-center border border-border rounded-lg overflow-hidden shrink-0">
          <button
            onClick={() => updateParam({ view: 'grid' })}
            className={`p-2 transition-colors ${view === 'grid' ? 'bg-elevated text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
            title="Grid view"
          >
            <LayoutGrid size={17} />
          </button>
          <button
            onClick={() => updateParam({ view: 'list' })}
            className={`p-2 transition-colors ${view === 'list' ? 'bg-elevated text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
            title="List view"
          >
            <List size={17} />
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className={`${sidebarOpen ? 'block' : 'hidden'} md:block w-64 shrink-0`}>
          <FilterSidebar
            filters={filterValues}
            language={language}
            onChange={updateParam}
            onReset={resetFilters}
          />
        </div>

        {/* Card display */}
        <div className="flex-1 min-w-0">
          {view === 'list' ? (
            <CardListView cards={cards} loading={isLoading} />
          ) : (
            <CardGrid cards={cards} loading={isLoading} />
          )}

          {/* Load more */}
          <div className="flex items-center justify-center mt-6">
            {isFetchingNextPage && <Spinner size="sm" />}
            {!isFetchingNextPage && hasNextPage && (
              <button
                onClick={() => fetchNextPage()}
                className="px-6 py-2.5 rounded-lg border border-border text-sm text-slate-300 hover:bg-elevated hover:border-accent-500 transition-colors"
              >
                Load more
              </button>
            )}
            {!hasNextPage && cards.length > 0 && (
              <p className="text-sm text-slate-600">All {totalCount.toLocaleString()} cards loaded</p>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
