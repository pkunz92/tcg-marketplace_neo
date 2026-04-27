'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import Image from 'next/image'
import {
  ShoppingBag,
  BarChart2,
  Wallet,
  Plus,
  Pencil,
  Trash2,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react'
import { api, type Listing, type Order, type Payout, type PaginatedResponse } from '@/lib/api'
import { formatCHF, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import Badge, { statusVariant } from '@/components/ui/badge'
import Button from '@/components/ui/button'
import Spinner from '@/components/ui/spinner'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/lib/auth-context'
import ProtectedRoute from '@/components/auth/protected-route'

type Tab = 'inventory' | 'sales' | 'payouts'

/* ---- Inventory tab ---- */

function InventoryTab() {
  const { toast } = useToast()
  const { data, isLoading, mutate } = useSWR('my-listings', () =>
    api.get<PaginatedResponse<Listing> | Listing[]>('/listings/?mine=true&include_unavailable=true'),
  )
  const listings: Listing[] = Array.isArray(data) ? data : (data?.results ?? [])

  async function deleteListing(id: string) {
    if (!confirm('Delete this listing?')) return
    try {
      await api.delete(`/listings/${id}/`)
      toast('Listing deleted', 'success')
      mutate()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed'
      toast(msg, 'error')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-200">Active Listings</h2>
        <div className="flex gap-2">
          <Link href="/market/new">
            <Button size="sm" data-testid="new-listing-btn">
              <Plus size={14} /> New Listing
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : listings.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <ShoppingBag size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No listings yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {listings.map((l) => (
            <div
              key={l.id}
              data-testid="listing-row"
              className="flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3"
            >
              <div className="relative w-10 h-[56px] shrink-0">
                <Image
                  src={l.card_image_url || '/placeholder-card.png'}
                  alt={l.card_name}
                  fill
                  className="object-contain rounded"
                  sizes="40px"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-200 truncate">{l.card_name}</p>
                <p className="text-xs text-slate-500 truncate">{l.set_name} · {l.condition}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono text-accent-400 font-semibold text-sm">{formatCHF(l.price_chf)}</p>
                <p className="text-xs text-slate-500">Qty: {l.quantity}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Link href={`/market/${l.id}/edit`}>
                  <button className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-elevated transition-colors">
                    <Pencil size={13} />
                  </button>
                </Link>
                <button
                  onClick={() => deleteListing(l.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/50 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---- Sales tab ---- */

function SalesTab() {
  const { data, isLoading } = useSWR('seller-sales', () =>
    api.get<PaginatedResponse<Order> | Order[]>('/orders/?role=seller'),
  )
  const orders: Order[] = Array.isArray(data) ? data : (data?.results ?? [])
  const completed = orders.filter((o) => o.status === 'COMPLETED')
  const revenue = completed.reduce(
    (sum, o) => sum + parseFloat(String(o.total_price ?? o.total_chf ?? 0)),
    0,
  )

  return (
    <div>
      {/* Revenue summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Sales', value: orders.length, color: 'text-slate-200', icon: ShoppingBag },
          { label: 'Completed', value: completed.length, color: 'text-green-400', icon: TrendingUp },
          { label: 'Revenue', value: formatCHF(revenue), color: 'text-emerald-400', icon: Wallet },
        ].map((s) => (
          <div key={s.label} className="bg-surface border border-border rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute top-3 right-3 opacity-10">
              <s.icon size={32} className={s.color} />
            </div>
            <p className={`text-2xl font-black font-mono ${s.color} stat-value`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold text-slate-200 mb-4">Recent Sales</h2>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm">No sales yet.</div>
      ) : (
        <div className="space-y-2">
          {orders.slice(0, 20).map((o) => (
            <Link
              key={o.id}
              href={`/orders/${o.id}`}
              className="flex items-center justify-between gap-4 bg-surface border border-border rounded-xl px-4 py-3 hover:border-accent-500/40 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-slate-200">{o.card_name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {o.buyer_username} · {formatDate(o.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <p className="font-mono text-emerald-400 font-semibold text-sm">
                  {formatCHF(o.total_price ?? o.total_chf)}
                </p>
                <Badge variant={statusVariant(o.status)}>{o.status}</Badge>
                <ArrowUpRight size={14} className="text-slate-600" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---- Payouts tab ---- */

function PayoutsTab() {
  const { data, isLoading } = useSWR('payouts', () =>
    api.get<Payout[]>('/payouts/').catch(() => [] as Payout[]),
  )
  const { toast } = useToast()
  const [initiating, setInitiating] = useState(false)

  async function initiatePayout() {
    setInitiating(true)
    try {
      await api.post('/payouts/', {})
      toast('Payout initiated via Stripe Connect', 'success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Payout failed'
      toast(msg, 'error')
    } finally {
      setInitiating(false)
    }
  }

  const payouts: Payout[] = data ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-slate-200">Stripe Connect Payouts</h2>
        <Button size="sm" onClick={initiatePayout} loading={initiating}>
          <Wallet size={14} />
          Initiate Payout
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : payouts.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Wallet size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No payout history yet.</p>
          <p className="text-xs mt-1 text-slate-600">
            Complete sales and initiate a payout to see history here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {payouts.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-4 bg-surface border border-border rounded-xl px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-slate-200">
                  Payout #{p.id.slice(0, 8)}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{formatDate(p.created_at)}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <p className="font-mono text-emerald-400 font-semibold">
                  {formatCHF(p.amount)}
                </p>
                <Badge variant={p.status === 'paid' ? 'success' : 'warning'}>
                  {p.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---- Main page ---- */

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'inventory', label: 'Inventory', icon: ShoppingBag },
  { id: 'sales', label: 'Sales', icon: BarChart2 },
  { id: 'payouts', label: 'Payouts', icon: Wallet },
]

function SellerDashboardContent() {
  const [activeTab, setActiveTab] = useState<Tab>('inventory')
  const { user } = useAuth()

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-100">Seller Dashboard</h1>
          {user && (
            <p className="text-slate-500 text-sm mt-1">
              Welcome back, <span className="text-accent-400 font-medium">{user.username}</span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/seller/orders">
            <Button variant="secondary" size="sm">
              <ShoppingBag size={14} />
              Sales Orders
            </Button>
          </Link>
          <Link href="/market/new">
            <Button size="sm">
              <Plus size={14} />
              New Listing
            </Button>
          </Link>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 mb-6 bg-surface border border-border rounded-xl p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all',
              activeTab === t.id
                ? 'bg-accent-500/20 text-accent-300 shadow-glow-sm'
                : 'text-slate-500 hover:text-slate-200 hover:bg-elevated',
            )}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'inventory' && <InventoryTab />}
      {activeTab === 'sales' && <SalesTab />}
      {activeTab === 'payouts' && <PayoutsTab />}
    </div>
  )
}

export default function SellerDashboardPage() {
  return (
    <ProtectedRoute>
      <SellerDashboardContent />
    </ProtectedRoute>
  )
}
