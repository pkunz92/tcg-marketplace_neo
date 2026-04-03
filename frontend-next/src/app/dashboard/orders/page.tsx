'use client'

import useSWR from 'swr'
import Link from 'next/link'
import Image from 'next/image'
import { Package } from 'lucide-react'
import { api, type Order, type PaginatedResponse } from '@/lib/api'
import { formatCHF, formatDate } from '@/lib/utils'
import Badge, { statusVariant } from '@/components/ui/badge'
import Spinner from '@/components/ui/spinner'
import Button from '@/components/ui/button'

const fetcher = () =>
  api.get<PaginatedResponse<Order> | Order[]>('/orders/?role=buyer')

function EmptyOrders() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-500">
      <Package size={40} />
      <p className="text-sm">No orders yet.</p>
      <Link href="/market">
        <Button variant="secondary" size="sm">Browse the market</Button>
      </Link>
    </div>
  )
}

export default function BuyerOrdersPage() {
  const { data, isLoading } = useSWR('buyer-orders', fetcher)
  const orders: Order[] = Array.isArray(data)
    ? data
    : (data?.results ?? [])

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">My Orders</h1>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : orders.length === 0 ? (
        <EmptyOrders />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/orders/${o.id}`}
              data-testid="order-row"
              className="flex items-center justify-between gap-4 bg-surface border border-border rounded-xl p-4 hover:border-accent-500/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="relative w-12 h-16 shrink-0">
                  <Image
                    src={o.card_image_url || '/placeholder-card.png'}
                    alt={o.card_name}
                    fill
                    className="object-contain rounded"
                    sizes="48px"
                  />
                </div>
                <div>
                  <p className="font-medium text-slate-200">{o.card_name}</p>
                  <p className="text-sm text-slate-400 mt-0.5">
                    Order #{o.id.slice(0, 8)} · {formatDate(o.created_at)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Qty: {o.quantity}</p>
                </div>
              </div>
              <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                <p className="font-mono text-accent-400 font-semibold">
                  {formatCHF(o.total_price ?? o.total_chf)}
                </p>
                <Badge variant={statusVariant(o.status)}>{o.status}</Badge>
                {o.status === 'PENDING' && (
                  <button
                    onClick={async (e) => {
                      e.preventDefault()
                      await api.patch(`/orders/${o.id}/`, { status: 'CANCELLED' })
                      window.location.reload()
                    }}
                    className="text-xs text-red-400 hover:underline"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
