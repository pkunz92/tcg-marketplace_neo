import { useSets, useSeries, useRarities } from '../../hooks/useSets'

const SUPERTYPES = ['Pokémon', 'Trainer', 'Energy']
const TYPES = [
  'Fire', 'Water', 'Grass', 'Lightning', 'Psychic', 'Fighting',
  'Darkness', 'Metal', 'Colorless', 'Dragon', 'Fairy',
]

function Section({ title, children }) {
  return (
    <div className="border-b border-border pb-4 mb-4 last:border-0 last:mb-0 last:pb-0">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">{title}</p>
      {children}
    </div>
  )
}

function CheckItem({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group py-0.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-3.5 h-3.5 rounded accent-yellow-400 shrink-0"
      />
      <span className="text-sm text-slate-400 group-hover:text-slate-200 transition-colors truncate">{label}</span>
    </label>
  )
}

export default function FilterSidebar({ filters, onChange, onReset }) {
  const { data: seriesList = [] } = useSeries()
  const { data: setsData } = useSets(
    filters.series ? { series: filters.series, ordering: '-release_date' } : { ordering: '-release_date' },
    { enabled: true }
  )
  const sets = setsData?.results || setsData || []

  const rarityParams = {}
  if (filters.set_code) rarityParams.set_code = filters.set_code
  else if (filters.series) rarityParams.series = filters.series
  const { data: rarities = [] } = useRarities(rarityParams)

  function toggle(key, value) {
    const current = filters[key] || ''
    onChange({ [key]: current === value ? '' : value })
  }

  function handleSeriesChange(series) {
    // Changing era clears set and rarity selections
    onChange({ series, set_code: '', rarity: '' })
  }

  function handleSetChange(set_code) {
    // Changing set clears rarity selection
    onChange({ set_code, rarity: '' })
  }

  const activeCount = Object.values(filters).filter(Boolean).length

  return (
    <aside className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-slate-200">
          Filters {activeCount > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 bg-accent-500/20 text-accent-400 rounded text-xs">{activeCount}</span>
          )}
        </span>
        <button onClick={onReset} className="text-xs text-accent-500 hover:text-accent-400 transition-colors">
          Reset all
        </button>
      </div>

      {/* Era (Series) */}
      <Section title="Era">
        <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto pr-1">
          {seriesList.map((s) => (
            <CheckItem
              key={s.series}
              label={`${s.series} (${s.set_count})`}
              checked={filters.series === s.series}
              onChange={() => handleSeriesChange(filters.series === s.series ? '' : s.series)}
            />
          ))}
        </div>
      </Section>

      {/* Set */}
      <Section title="Set">
        <select
          value={filters.set_code || ''}
          onChange={(e) => handleSetChange(e.target.value)}
          className="w-full bg-elevated border border-border rounded-lg px-2 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-accent-500"
        >
          <option value="">All sets{filters.series ? ` in ${filters.series}` : ''}</option>
          {sets.map?.((s) => (
            <option key={s.set_code} value={s.set_code}>{s.set_name}</option>
          ))}
        </select>
      </Section>

      {/* Rarity — dynamic based on selected set/era */}
      <Section title="Rarity">
        <div className="flex flex-col gap-0.5 max-h-52 overflow-y-auto pr-1">
          {rarities.length === 0 ? (
            <p className="text-xs text-slate-600 italic">Select an era or set to see rarities</p>
          ) : (
            rarities.map((r) => (
              <CheckItem
                key={r}
                label={r}
                checked={filters.rarity === r}
                onChange={() => toggle('rarity', r)}
              />
            ))
          )}
        </div>
      </Section>

      {/* Card type */}
      <Section title="Card Type">
        {SUPERTYPES.map((st) => (
          <CheckItem
            key={st}
            label={st}
            checked={filters.supertype === st}
            onChange={() => toggle('supertype', st)}
          />
        ))}
      </Section>

      {/* Energy Type */}
      <Section title="Energy Type">
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => toggle('types', t)}
              className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                filters.types === t
                  ? 'border-accent-500 text-accent-400 bg-accent-500/10'
                  : 'border-border text-slate-400 hover:border-slate-500'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </Section>

      {/* HP Range */}
      <Section title="HP Range">
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Min"
            value={filters.hp_min || ''}
            onChange={(e) => onChange({ hp_min: e.target.value })}
            className="w-full bg-elevated border border-border rounded-lg px-2 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-accent-500"
          />
          <span className="text-slate-500 shrink-0">—</span>
          <input
            type="number"
            placeholder="Max"
            value={filters.hp_max || ''}
            onChange={(e) => onChange({ hp_max: e.target.value })}
            className="w-full bg-elevated border border-border rounded-lg px-2 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-accent-500"
          />
        </div>
      </Section>

      {/* Pricing */}
      <Section title="Pricing">
        <CheckItem
          label="Has price data"
          checked={!!filters.has_price}
          onChange={(v) => onChange({ has_price: v ? 'true' : '' })}
        />
      </Section>
    </aside>
  )
}
