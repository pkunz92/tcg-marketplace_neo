import { useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { useCardPriceHistory } from '../../hooks/useCards'
import Spinner from '../ui/Spinner'

const DAYS_OPTIONS = [
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
  { label: '1y',  value: 365 },
]

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-elevated border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-mono">
          {p.name}: {p.value != null ? `${p.value.toFixed(2)} ${p.payload.currency || ''}` : '—'}
        </p>
      ))}
    </div>
  )
}

export default function PriceHistoryChart({ apiId }) {
  const [days, setDays] = useState(90)
  const { data: groups = [], isLoading } = useCardPriceHistory(apiId, { days })

  // Pick the most relevant group to show by default:
  // prefer tcgplayer/holofoil, then tcgplayer/normal, then first available
  const [activeKey, setActiveKey] = useState(null)

  const groupMap = {}
  for (const g of groups) {
    groupMap[`${g.source}/${g.variant}`] = g
  }

  const keys = Object.keys(groupMap)
  const defaultKey = keys.find(k => k === 'tcgplayer/holofoil')
    || keys.find(k => k.startsWith('tcgplayer'))
    || keys[0]
    || null
  const key = activeKey && groupMap[activeKey] ? activeKey : defaultKey
  const group = key ? groupMap[key] : null

  if (isLoading) return (
    <div className="flex items-center justify-center h-32">
      <Spinner size="sm" />
    </div>
  )

  if (!group || group.points.length < 2) {
    return (
      <p className="text-sm text-slate-500 text-center py-6">
        Price history will appear after the next scheduled fetch.
      </p>
    )
  }

  const currency = group.currency === 'USD' ? '$' : '€'

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        {/* Variant selector */}
        <div className="flex flex-wrap gap-1.5">
          {keys.map((k) => (
            <button
              key={k}
              onClick={() => setActiveKey(k)}
              className={`text-xs px-2.5 py-1 rounded-md border transition-colors capitalize ${
                k === key
                  ? 'border-accent-500 text-accent-400 bg-accent-500/10'
                  : 'border-border text-slate-500 hover:border-slate-500'
              }`}
            >
              {groupMap[k].source} · {groupMap[k].variant}
            </button>
          ))}
        </div>
        {/* Days selector */}
        <div className="flex items-center gap-1">
          {DAYS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                days === opt.value
                  ? 'border-accent-500 text-accent-400 bg-accent-500/10'
                  : 'border-border text-slate-500 hover:border-slate-500'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={group.points} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${currency}${v}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
            iconType="circle"
            iconSize={8}
          />
          <Line
            type="monotone"
            dataKey="market"
            name="Market"
            stroke="#f5c842"
            dot={false}
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="low"
            name="Low"
            stroke="#64748b"
            dot={false}
            strokeWidth={1}
            strokeDasharray="4 2"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
