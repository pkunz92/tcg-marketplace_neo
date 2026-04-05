'use client'

import useSWR from 'swr'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import { api } from '@/lib/api'
import { formatCHF } from '@/lib/utils'

interface SoldPoint {
  date: string
  price: string
  condition: string
}

interface Props {
  cardApiId: string
  days?: number
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function SoldPriceSparkline({ cardApiId, days = 30 }: Props) {
  const { data, isLoading } = useSWR<SoldPoint[]>(
    cardApiId ? `sold-price-${cardApiId}-${days}` : null,
    () => api.get<SoldPoint[]>(`/cards/${cardApiId}/sold-price-history/?days=${days}`),
  )

  if (isLoading) {
    return (
      <div className="h-24 flex items-center justify-center text-xs text-slate-600">
        Loading price history…
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-24 flex items-center justify-center text-xs text-slate-600">
        No recent sales data
      </div>
    )
  }

  const chartData = data.map((p) => ({
    date: formatDate(p.date),
    price: parseFloat(p.price),
    condition: p.condition,
  }))

  const prices = chartData.map((p) => p.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-500 uppercase tracking-wide">
          Last {days}d sold prices ({data.length} sales)
        </p>
        <div className="text-xs text-slate-500 font-mono">
          {formatCHF(min)} – {formatCHF(max)}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
          <XAxis dataKey="date" hide />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{
              background: '#1a1f2e',
              border: '1px solid #2d3448',
              borderRadius: 8,
              fontSize: 11,
            }}
            formatter={(value: number) => [formatCHF(value), 'Sold']}
            labelStyle={{ color: '#94a3b8', marginBottom: 2 }}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="#6366f1"
            strokeWidth={2}
            dot={data.length <= 10}
            activeDot={{ r: 4, fill: '#818cf8' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
