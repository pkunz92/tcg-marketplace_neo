'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import useSWR from 'swr'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts'
import { TrendingUp, ArrowLeft, BarChart2, Activity, Layers } from 'lucide-react'
import { api } from '@/lib/api'
import { formatCHF } from '@/lib/utils'
import Spinner from '@/components/ui/spinner'

const CONDITION_LABELS: Record<string, string> = {
  MT: 'Mint',
  NM: 'Near Mint',
  LP: 'Lightly Played',
  MP: 'Moderately Played',
  HP: 'Heavily Played',
  DMG: 'Damaged',
}

const CONDITION_COLORS: Record<string, string> = {
  MT: '#34d399',
  NM: '#4ade80',
  LP: '#facc15',
  MP: '#fb923c',
  HP: '#f87171',
  DMG: '#ef4444',
}

const TCG_LABELS: Record<string, string> = {
  pokemon: 'Pokémon',
  mtg: 'Magic: The Gathering',
  yugioh: 'Yu-Gi-Oh!',
  sports: 'Sports Cards',
}

interface TopMover {
  card_api_id: string
  card_name: string
  image_url: string | null
  tcg_type: string
  sales_count: number
  avg_price: string | null
  total_volume: string | null
}

interface ConditionStats {
  avg_price: string | null
  count: number
}

interface VolumeStats {
  tcg_type: string
  count: number
  total_revenue: string | null
}

interface AnalyticsData {
  period_days: number
  top_movers: TopMover[]
  avg_price_by_condition: Record<string, ConditionStats>
  volume_stats: VolumeStats[]
}

const DAYS_OPTIONS = [7, 30, 90, 365]
const BAR_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd']

export default function MarketAnalyticsPage() {
  const [days, setDays] = useState(30)

  const { data, isLoading, error } = useSWR<AnalyticsData>(
    `market-analytics-${days}`,
    () => api.get<AnalyticsData>(`/market/analytics/?days=${days}`),
  )

  const conditionChartData = data
    ? Object.entries(data.avg_price_by_condition).map(([cond, stats]) => ({
        condition: CONDITION_LABELS[cond] ?? cond,
        avg_price: stats.avg_price ? parseFloat(stats.avg_price) : 0,
        count: stats.count,
        color: CONDITION_COLORS[cond] ?? '#6366f1',
      }))
    : []

  const volumeChartData = data
    ? data.volume_stats.map((v, i) => ({
        name: TCG_LABELS[v.tcg_type] ?? v.tcg_type,
        count: v.count,
        revenue: v.total_revenue ? parseFloat(v.total_revenue) : 0,
        color: BAR_COLORS[i % BAR_COLORS.length],
      }))
    : []

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link
            href="/market"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-200 transition-colors mb-3"
          >
            <ArrowLeft size={15} />
            Marketplace
          </Link>
          <h1 className="text-3xl font-black text-slate-100 flex items-center gap-3">
            <TrendingUp size={28} className="text-accent-400" />
            Market Analytics
          </h1>
          <p className="text-slate-400 text-sm mt-1">Real sold prices from completed orders</p>
        </div>
        {/* Period selector */}
        <div className="flex gap-2">
          {DAYS_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                days === d
                  ? 'bg-accent-500/20 border-accent-500/40 text-accent-300'
                  : 'bg-surface border-border text-slate-400 hover:text-slate-200'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <Spinner />
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-6 text-red-400 text-sm">
          Failed to load analytics. Please try again.
        </div>
      )}

      {data && (
        <div className="space-y-8">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-surface border border-border rounded-2xl p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                <Activity size={11} /> Total Sales
              </p>
              <p className="text-2xl font-black text-slate-100">
                {data.volume_stats.reduce((s, v) => s + v.count, 0)}
              </p>
              <p className="text-xs text-slate-600 mt-1">last {days} days</p>
            </div>
            <div className="bg-surface border border-border rounded-2xl p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                <BarChart2 size={11} /> Total Revenue
              </p>
              <p className="text-2xl font-black gradient-text">
                {formatCHF(
                  data.volume_stats.reduce((s, v) => s + (v.total_revenue ? parseFloat(v.total_revenue) : 0), 0),
                )}
              </p>
              <p className="text-xs text-slate-600 mt-1">CHF · last {days} days</p>
            </div>
            <div className="bg-surface border border-border rounded-2xl p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                <TrendingUp size={11} /> Top Card
              </p>
              <p className="text-sm font-bold text-slate-100 truncate">
                {data.top_movers[0]?.card_name ?? '—'}
              </p>
              <p className="text-xs text-slate-600 mt-1">
                {data.top_movers[0]?.sales_count ?? 0} sales
              </p>
            </div>
            <div className="bg-surface border border-border rounded-2xl p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                <Layers size={11} /> Card Types
              </p>
              <p className="text-2xl font-black text-slate-100">
                {data.volume_stats.length}
              </p>
              <p className="text-xs text-slate-600 mt-1">active TCG markets</p>
            </div>
          </div>

          {/* Charts row */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Avg price by condition */}
            <div className="bg-surface border border-border rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-slate-200 mb-4">Avg. Sold Price by Condition</h2>
              {conditionChartData.length === 0 ? (
                <p className="text-xs text-slate-600 py-8 text-center">No data for this period</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={conditionChartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                    <XAxis dataKey="condition" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `CHF ${v}`} />
                    <Tooltip
                      contentStyle={{ background: '#1a1f2e', border: '1px solid #2d3448', borderRadius: 8, fontSize: 11 }}
                      formatter={(value: number, _name: string, props: { payload?: { count: number } }) => [
                        `${formatCHF(value)} (${props.payload?.count ?? 0} sales)`,
                        'Avg Price',
                      ]}
                    />
                    <Bar dataKey="avg_price" radius={[4, 4, 0, 0]}>
                      {conditionChartData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Volume by TCG type */}
            <div className="bg-surface border border-border rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-slate-200 mb-4">Sales Volume by TCG</h2>
              {volumeChartData.length === 0 ? (
                <p className="text-xs text-slate-600 py-8 text-center">No data for this period</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={volumeChartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip
                      contentStyle={{ background: '#1a1f2e', border: '1px solid #2d3448', borderRadius: 8, fontSize: 11 }}
                      formatter={(value: number) => [value, 'Sales']}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {volumeChartData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top movers */}
          <div className="bg-surface border border-border rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <TrendingUp size={14} className="text-accent-400" />
              Top Traded Cards — last {days} days
            </h2>
            {data.top_movers.length === 0 ? (
              <p className="text-xs text-slate-600 py-8 text-center">No sales data for this period</p>
            ) : (
              <div className="divide-y divide-border">
                {data.top_movers.map((card, i) => (
                  <Link
                    key={card.card_api_id}
                    href={`/market?card=${card.card_api_id}`}
                    className="flex items-center gap-4 py-3 hover:bg-elevated/50 rounded-xl px-2 transition-colors -mx-2"
                  >
                    <span className="text-xs font-mono text-slate-600 w-5 text-right shrink-0">
                      {i + 1}
                    </span>
                    {card.image_url ? (
                      <Image
                        src={card.image_url}
                        alt={card.card_name}
                        width={32}
                        height={44}
                        className="object-contain rounded shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-11 bg-elevated rounded shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-200 truncate">{card.card_name}</p>
                      <p className="text-xs text-slate-500">{TCG_LABELS[card.tcg_type] ?? card.tcg_type}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-slate-200">
                        {card.sales_count} sales
                      </p>
                      {card.avg_price && (
                        <p className="text-xs text-slate-500">
                          avg {formatCHF(parseFloat(card.avg_price))}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
