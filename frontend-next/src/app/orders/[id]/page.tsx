'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { AlertTriangle, ArrowLeft, Package, Star, Truck } from 'lucide-react'
import { api, type Order, type Review, type Dispute, type DisputeReason } from '@/lib/api'
import { formatCHF, formatDate } from '@/lib/utils'
import Badge, { statusVariant } from '@/components/ui/badge'
import Spinner from '@/components/ui/spinner'
import ReviewForm from '@/components/ui/review-form'
import { useAuth } from '@/lib/auth-context'

const fetcher = (id: string) => api.get<Order>(`/orders/${id}/`)

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { data: order, isLoading, mutate } = useSWR(id ? `order-${id}` : null, () =>
    fetcher(id),
  )
  const [submittedReview, setSubmittedReview] = useState<Review | null>(null)
  const [disputeOpen, setDisputeOpen] = useState(false)
  const [disputeReason, setDisputeReason] = useState<DisputeReason>('not_received')
  const [disputeDesc, setDisputeDesc] = useState('')
  const [disputeError, setDisputeError] = useState('')
  const [disputeSubmitting, setDisputeSubmitting] = useState(false)
  const [disputeSuccess, setDisputeSuccess] = useState<Dispute | null>(null)

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
  const isBuyer = user?.username === order.buyer_username
  const isDelivered = order.status === 'DELIVERED'
  const alreadyReviewed = submittedReview !== null || order.review != null
  const canReview = isBuyer && isDelivered && !alreadyReviewed
  const canDispute = isBuyer && (order.status === 'COMPLETED' || order.status === 'SHIPPED') && !disputeSuccess

  function handleReviewSuccess(review: Review) {
    setSubmittedReview(review)
    mutate()
  }

  async function handleDisputeSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!disputeDesc.trim()) {
      setDisputeError('Please describe the issue.')
      return
    }
    setDisputeSubmitting(true)
    setDisputeError('')
    try {
      const dispute = await api.post<Dispute>(`/orders/${id}/dispute/`, {
        reason: disputeReason,
        description: disputeDesc,
      })
      setDisputeSuccess(dispute)
      setDisputeOpen(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to open dispute.'
      setDisputeError(msg)
    } finally {
      setDisputeSubmitting(false)
    }
  }

  const review = submittedReview ?? order.review ?? null

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

        {/* Review section */}
        {review && (
          <div className="p-5 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <Star size={15} className="fill-yellow-400 text-yellow-400" />
              <h3 className="text-sm font-medium text-slate-300">Your Review</h3>
            </div>
            <div className="flex gap-0.5 mb-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={16}
                  className={n <= review.stars ? 'fill-yellow-400 text-yellow-400' : 'text-slate-600'}
                />
              ))}
            </div>
            {review.comment && (
              <p className="text-sm text-slate-400 mt-1">{review.comment}</p>
            )}
          </div>
        )}

        {canReview && (
          <div className="p-5 border-t border-border">
            <div className="flex items-center gap-2 mb-4">
              <Star size={15} className="text-yellow-400" />
              <h3 className="text-sm font-medium text-slate-300">Rate this seller</h3>
            </div>
            <ReviewForm orderId={id} onSuccess={handleReviewSuccess} />
          </div>
        )}

        {/* Dispute section */}
        {disputeSuccess && (
          <div className="p-5 border-t border-border">
            <div className="flex items-center gap-2 text-yellow-400 mb-1">
              <AlertTriangle size={15} />
              <span className="text-sm font-medium">Dispute opened</span>
            </div>
            <p className="text-xs text-slate-400">
              Your dispute has been submitted. Our team will review it shortly.
            </p>
          </div>
        )}

        {canDispute && !disputeOpen && (
          <div className="p-5 border-t border-border">
            <button
              onClick={() => setDisputeOpen(true)}
              className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              <AlertTriangle size={14} />
              Open a dispute
            </button>
          </div>
        )}

        {canDispute && disputeOpen && (
          <div className="p-5 border-t border-border">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={15} className="text-red-400" />
              <h3 className="text-sm font-medium text-slate-300">Open a dispute</h3>
            </div>
            <form onSubmit={handleDisputeSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Reason</label>
                <select
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value as DisputeReason)}
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-slate-200"
                >
                  <option value="not_received">Item Not Received</option>
                  <option value="not_as_described">Item Not As Described</option>
                  <option value="unauthorized">Unauthorized Payment</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Description</label>
                <textarea
                  value={disputeDesc}
                  onChange={(e) => setDisputeDesc(e.target.value)}
                  rows={3}
                  placeholder="Describe the issue in detail…"
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-slate-200 resize-none"
                />
              </div>
              {disputeError && (
                <p className="text-xs text-red-400">{disputeError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={disputeSubmitting}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                >
                  {disputeSubmitting ? 'Submitting…' : 'Submit dispute'}
                </button>
                <button
                  type="button"
                  onClick={() => { setDisputeOpen(false); setDisputeError('') }}
                  className="px-4 py-2 rounded-lg border border-border text-sm text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
