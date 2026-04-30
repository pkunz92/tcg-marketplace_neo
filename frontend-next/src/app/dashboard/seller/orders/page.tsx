'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import Image from 'next/image'
import { Package, Truck } from 'lucide-react'
import { api, type Order, type PaginatedResponse } from '@/lib/api'
import { formatCHF, formatDate } from '@/lib/utils'
import Badge, { statusVariant } from '@/components/ui/badge'
import Spinner from '@/components/ui/spinner'
import Button from '@/components/ui/button'
import Input from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import ProtectedRoute from '@/components/auth/protected-route'

const fetcher = () =>
  api.get<PaginatedResponse<Order> | Order[]>('/orders/?role=seller')

function MarkShippedModal({
  orderId,
  onClose,
  onSuccess,
}: {
  orderId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [tracking, setTracking] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.patch(`/orders/${orderId}/`, {
        status: 'SHIPPED',
        tracking_number: tracking,
      })
      toast('Marked as shipped!', 'success')
      onSuccess()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update order'
      toast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-sm">
        <h2 className="text-lg font-semibold text-slate-100 mb-4">Mark as Shipped</h2>
        <form onSubmit={submit} className="space-y-4">
          <Input
            label="Tracking Number (optional)"
            placeholder="1Z999AA10123456784"
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              <Truck size={14} />
              Mark Shipped
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SellerOrdersContent() {
  const { data, isLoading, mutate } = useSWR('seller-orders', fetcher)
  const [shippingOrderId, setShippingOrderId] = useState<string | null>(null)

  const orders: Order[] = Array.isArray(data) ? data : (data?.results ?? [])

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">Sales Orders</h1>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-500">
          <Package size={40} />
          <p className="text-sm">No sales yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div
              key={o.id}
              data-testid="seller-order-row"
              className="bg-surface border border-border rounded-xl p-4"
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
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
                      Order #{String(o.id).slice(0, 8)} · {formatDate(o.created_at)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Buyer: {o.buyer_username} · Qty: {o.quantity}
                    </p>
                    {o.tracking_number && (
                      <p className="text-xs text-blue-400 mt-0.5">
                        Tracking: {o.tracking_number}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <p className="font-mono text-emerald-400 font-semibold">
                    {formatCHF(o.total_price ?? o.total_chf)}
                  </p>
                  <Badge variant={statusVariant(o.status)}>{o.status}</Badge>
                  <div className="flex gap-2">
                    <Link href={`/orders/${o.id}`} className="text-xs text-accent-400 hover:underline">
                      View
                    </Link>
                    {o.status === 'PENDING' && (
                      <button
                        onClick={() => setShippingOrderId(o.id)}
                        className="text-xs text-blue-400 hover:underline"
                      >
                        Mark Shipped
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Shipping address */}
              <div className="mt-3 pt-3 border-t border-border text-xs text-slate-500">
                Ship to: {o.shipping_name}, {o.shipping_address_line1},{' '}
                {o.shipping_city} {o.shipping_postal_code}, {o.shipping_country}
              </div>
            </div>
          ))}
        </div>
      )}

      {shippingOrderId && (
        <MarkShippedModal
          orderId={shippingOrderId}
          onClose={() => setShippingOrderId(null)}
          onSuccess={() => {
            setShippingOrderId(null)
            mutate()
          }}
        />
      )}
    </div>
  )
}

export default function SellerOrdersPage() {
  return (
    <ProtectedRoute>
      <SellerOrdersContent />
    </ProtectedRoute>
  )
}
