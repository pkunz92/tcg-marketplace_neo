import { useSearchParams } from 'react-router-dom'
import { LayoutGrid, SlidersHorizontal, X } from 'lucide-react'
import { useState } from 'react'
import { useCardsList } from '../hooks/useCards'
import { useDebounce } from '../hooks/useDebounce'
import CardGrid from '../components/cards/CardGrid'
import FilterSidebar from '../components/catalog/FilterSidebar'
import SearchInput from '../components/catalog/SearchInput'
import SortSelector from '../components/catalog/SortSelector'
import PaginationControls from '../components/catalog/PaginationControls'
import PageContainer from '../components/layout/PageContainer'

function buildParams(searchParams) {
  const p = {}
  for (const [k, v] of searchParams.entries()) {
    if (v) p[k] = v
  }
  return p
}

export default function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const search = searchParams.get('search') || ''
  const page = Number(searchParams.get('page') || 1)
  const ordering = searchParams.get('ordering') || ''
  const debouncedSearch = useDebounce(search, 300)

  const params = {
    ...buildParams(searchParams),
    search: debouncedSearch,
    page,
    ordering,
  }
  // Remove empty
  Object.keys(params).forEach((k) => { if (!params[k] && params[k] !== 0) delete params[k] })

  const { data, isLoading } = useCardsList(params)
  const cards = data?.results || []
  const totalCount = data?.count || 0

  function updateParam(updates) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      Object.entries(updates).forEach(([k, v]) => {
        if (v) next.set(k, v)
        else next.delete(k)
      })
      next.set('page', '1')
      return next
    })
  }

  function resetFilters() {
    setSearchParams({ search: search || '' })
  }

  const filterValues = {
    series: searchParams.get('series') || '',
    supertype: searchParams.get('supertype') || '',
    rarity: searchParams.get('rarity') || '',
    types: searchParams.get('types') || '',
    set_code: searchParams.get('set_code') || '',
    hp_min: searchParams.get('hp_min') || '',
    hp_max: searchParams.get('hp_max') || '',
    has_price: searchParams.get('has_price') || '',
  }

  const activeFilters = Object.entries(filterValues).filter(([, v]) => !!v)

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Card Catalog</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {totalCount > 0 ? `${totalCount.toLocaleString()} cards` : 'Browse all Pokemon TCG cards'}
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
              {v}
              <button onClick={() => updateParam({ [k]: '' })} className="text-slate-500 hover:text-slate-200">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <SearchInput
          value={search}
          onChange={(v) => updateParam({ search: v })}
          className="flex-1"
        />
        <SortSelector value={ordering} onChange={(v) => updateParam({ ordering: v })} />
      </div>

      <div className="flex gap-6">
        {/* Sidebar — desktop always visible, mobile overlay */}
        <div className={`${sidebarOpen ? 'block' : 'hidden'} md:block w-56 shrink-0`}>
          <FilterSidebar
            filters={filterValues}
            onChange={updateParam}
            onReset={resetFilters}
          />
        </div>

        <div className="flex-1 min-w-0">
          <CardGrid cards={cards} loading={isLoading} />
          <PaginationControls
            page={page}
            totalCount={totalCount}
            onPage={(p) => updateParam({ page: String(p) })}
          />
        </div>
      </div>
    </PageContainer>
  )
}
