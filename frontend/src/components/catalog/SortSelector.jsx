export default function SortSelector({ value, onChange }) {
  const options = [
    { value: 'card_name', label: 'Name A→Z' },
    { value: '-card_name', label: 'Name Z→A' },
    { value: '-id', label: 'Newest' },
    { value: 'card_rarity', label: 'Rarity' },
  ]
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-accent-500"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
