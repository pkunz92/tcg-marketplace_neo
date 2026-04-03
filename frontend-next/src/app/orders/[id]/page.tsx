'use client'

import useSWR from 'swr'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Package, Truck } from 'lucide-react'
import { api, type Order } from '@/lib/api'
import { formatCHF, formatDate } from '@/lib/utils'
import Badge, { statusVariant } from '@/components/ui/badge'
import Spinner from '@/components/ui/spinner'
import { useAuth } from '@/lib/auth-context'

const fetcher = (id: string) => api.get<Order>(`/orders/${id}/`)

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { data: order, isLoading } = useSWR(id ? `order-${id}` : null, () =>
    fetcher(id),
  )

  if (isLoading) {
    return (
      <div className="flex justify-center py-32">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!order) {
    return <p className="text-slate-400 text-center py-32">Order not found.</p>
  }

  const isSeller = user?.username === order.seller_username

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href={isSeller ? '/dashboard/seller/orders' : '/dashboard/orders'}
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors mb-6"
      >
        <ArrowLeft size={15} />
        Back to orders
      </Link>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 p-5 border-b border-border">
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Order ID</p>
            <p className="font-mono text-sm text-slate-300">{order.id}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 mb-0.5">Placed</p>
            <p className="text-sm text-slate-300">{formatDate(order.created_at)}</p>
          </div>
        </div>

        {/* Card info */}
        <div className="flex gap-4 p-5 border-b border-border">
          <div className="relative w-16 h-[88px] shrink-0">
            <Image
              src={order.card_image_url || '/placeholder-card.png'}
              alt={order.card_name}
              fill
              className="object-contain rounded-lg"
              sizes="64px"
            />
          </div>
          <div>
            <p className="font-semibold text-slate-100">{order.card_name}</p>
            <p className="text-sm text-slate-400 mt-0.5">{order.set_name}</p>
            <p className="text-xs text-slate-500 mt-0.5">Condition: {order.condition}</p>
            <p className="text-xs text-slate-500">Qty: {order.quantity}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="font-mono text-accent-400 font-bold text-lg">
              {formatCHF(order.total_price ?? order.total_chf)}
            </p>
            <Badge variant={statusVariant(order.status)} className="mt-1">
              {order.status}
            </Badge>
          </div>
        </div>

        {/* Parties */}
        <div className="grid grid-cols-2 gap-px bg-border">
          <div className="bg-surface p-5">
            <p className="text-xs text-slate-500 mb-1">Buyer</p>
            <p className="text-sm text-slate-200">{order.buyer_username}</p>
          </div>
          <div className="bg-surface p-5">
            <p className="text-xs text-slate-500 mb-1">Seller</p>
            <p className="text-sm text-slate-200">{order.seller_username}</p>
          </div>
        </div>

        {/* Shipping info */}
        <div className="p-5 border-t border-border">
          <div className="flex items-center gap-2 mb-3">
            <Package size={15} className="text-slate-400" />
            <h3 className="text-sm font-medium text-slate-300">Shipping Address</h3>
          </div>
          <p className="text-sm text-slate-400">
            {order.shipping_name}
            <br />
            {order.shipping_address_line1}
            <br />
            {order.shipping_city} {order.shipping_postal_code}
            <br />
            {order.shipping_country}
          </p>
        </div>

        {/* Tracking (if shipped) */}
        {order.tracking_number && (
          <div className="p-5 border-t border-border">
            <div className="flex items-center gap-2 mb-1">
              <Truck size={15} className="text-blue-400" />
              <h3 className="text-sm font-medium text-slate-300">Tracking Number</h3>
            </div>
            <p className="font-mono text-sm text-blue-400">{order.tracking_number}</p>
          </div>
        )}
      </div>
    </div>
  )
}
