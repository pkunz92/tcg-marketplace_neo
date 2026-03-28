import { useSets } from '../../hooks/useSets'
import Button from '../ui/Button'

const SUPERTYPES = ['Pokémon', 'Trainer', 'Energy']
const RARITIES = [
  'Common', 'Uncommon', 'Rare', 'Rare Holo', 'Rare Holo EX', 'Rare Holo GX',
  'Rare Holo V', 'Rare Holo VMAX', 'Rare Holo VSTAR', 'Rare Ultra', 'Rare Secret',
  'Amazing Rare', 'Rare Rainbow', 'Promo', 'LEGEND',
]
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
    <label className="flex items-center gap-2 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-3.5 h-3.5 rounded accent-yellow-400"
      />
      <span className="text-sm text-slate-400 group-hover:text-slate-200 transition-colors">{label}</span>
    </label>
  )
}

export default function FilterSidebar({ filters, onChange, onReset }) {
  const { data: setsData } = useSets()
  const sets = setsData?.results || setsData || []

  function toggle(key, value) {
    const current = filters[key] || ''
    onChange({ [key]: current === value ? '' : value })
  }

  return (
    <aside className="bg-surface border border-border rounded-xl p-4 space-y-0">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-slate-200">Filters</span>
        <button onClick={onReset} className="text-xs text-accent-500 hover:text-accent-400">
          Reset all
        </button>
      </div>

      <Section title="Type">
        {SUPERTYPES.map((st) => (
          <CheckItem
            key={st}
            label={st}
            checked={filters.supertype === st}
            onChange={() => toggle('supertype', st)}
          />
        ))}
      </Section>

      <Section title="Rarity">
        <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
          {RARITIES.map((r) => (
            <CheckItem
              key={r}
              label={r}
              checked={filters.rarity === r}
              onChange={() => toggle('rarity', r)}
            />
          ))}
        </div>
      </Section>

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

      <Section title="Set">
        <select
          value={filters.set_code || ''}
          onChange={(e) => onChange({ set_code: e.target.value })}
          className="w-full bg-elevated border border-border rounded-lg px-2 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-accent-500"
        >
          <option value="">All sets</option>
          {sets.map?.((s) => (
            <option key={s.set_code} value={s.set_code}>{s.set_name}</option>
          ))}
        </select>
      </Section>

      <Section title="HP Range">
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Min"
            value={filters.hp_min || ''}
            onChange={(e) => onChange({ hp_min: e.target.value })}
            className="w-full bg-elevated border border-border rounded-lg px-2 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-accent-500"
          />
          <span className="text-slate-500">—</span>
          <input
            type="number"
            placeholder="Max"
            value={filters.hp_max || ''}
            onChange={(e) => onChange({ hp_max: e.target.value })}
            className="w-full bg-elevated border border-border rounded-lg px-2 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-accent-500"
          />
        </div>
      </Section>

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
