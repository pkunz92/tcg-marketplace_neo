'use client'

import { useState } from 'react'
import { X, Tag } from 'lucide-react'
import { api, type Offer, type OfferStatus } from '@/lib/api'
import { formatCHF } from '@/lib/utils'
import Button from '@/components/ui/button'

const STATUS_LABELS: Record<OfferStatus, string> = {
  PENDING: 'Offer sent — awaiting seller response',
  COUNTERED: 'Seller made a counter-offer',
  ACCEPTED: 'Offer accepted!',
  DECLINED: 'Offer declined',
  EXPIRED: 'Offer expired',
}

const STATUS_COLORS: Record<OfferStatus, string> = {
  PENDING: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/25',
  COUNTERED: 'text-blue-400 bg-blue-400/10 border-blue-400/25',
  ACCEPTED: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/25',
  DECLINED: 'text-red-400 bg-red-400/10 border-red-400/25',
  EXPIRED: 'text-slate-400 bg-slate-400/10 border-slate-400/25',
}

interface Props {
  listingId: string
  listingPrice: number
  existingOffer: Offer | null
  onClose: () => void
  onSuccess: (offer: Offer) => void
}

export default function MakeOfferModal({ listingId, listingPrice, existingOffer, onClose, onSuccess }: Props) {
  const [price, setPrice] = useState(
    existingOffer ? existingOffer.price_chf : String(Math.floor(listingPrice * 0.9))
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const numPrice = parseFloat(price)
    if (isNaN(numPrice) || numPrice <= 0) {
      setError('Please enter a valid price.')
      return
    }
    if (numPrice >= listingPrice) {
      setError('Your offer must be below the listed price. Use "Buy Now" to purchase at full price.')
      return
    }
    setSubmitting(true)
    try {
      const offer = await api.post<Offer>('/offers/', { listing: listingId, price_chf: numPrice.toFixed(2) })
      onSuccess(offer)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit offer.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCounterResponse(accept: boolean) {
    if (!existingOffer) return
    setSubmitting(true)
    setError(null)
    try {
      const updated = await api.patch<Offer>(`/offers/${existingOffer.id}/`, {
        status: accept ? 'ACCEPTED' : 'DECLINED',
      })
      onSuccess(updated)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update offer.')
    } finally {
      setSubmitting(false)
    }
  }

  const isCountered = existingOffer?.status === 'COUNTERED'
  const isTerminal = existingOffer && ['ACCEPTED', 'DECLINED', 'EXPIRED'].includes(existingOffer.status)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-surface border border-border rounded-2xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Tag size={15} className="text-accent-400" />
            <span className="font-semibold text-slate-200 text-sm">Make an Offer</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Existing offer status */}
          {existingOffer && (
            <div className={`text-xs font-medium px-3 py-2 rounded-lg border ${STATUS_COLORS[existingOffer.status]}`}>
              {STATUS_LABELS[existingOffer.status]}
              {existingOffer.counter_price_chf && (
                <span className="block mt-0.5 font-mono">
                  Counter: {formatCHF(parseFloat(existingOffer.counter_price_chf))}
                </span>
              )}
            </div>
          )}

          {/* Counter-offer response buttons */}
          {isCountered && existingOffer?.counter_price_chf && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400">
                The seller countered at <span className="font-mono text-slate-200">{formatCHF(parseFloat(existingOffer.counter_price_chf))}</span>. Accept or decline?
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleCounterResponse(true)}
                  loading={submitting}
                  className="flex-1"
                  size="sm"
                >
                  Accept
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleCounterResponse(false)}
                  loading={submitting}
                  className="flex-1"
                  size="sm"
                >
                  Decline
                </Button>
              </div>
            </div>
          )}

          {/* New offer form — shown when no active offer or after terminal state */}
          {(!existingOffer || isTerminal) && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  Your offer (CHF) — listed at <span className="text-slate-200 font-mono">{formatCHF(listingPrice)}</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-mono">CHF</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    className="w-full bg-elevated border border-border rounded-lg pl-12 pr-3 py-2 text-sm font-mono text-slate-200 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30"
                    placeholder="0.00"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-600 mt-1">Offer expires in 48 hours if not responded to.</p>
              </div>

              {error && (
                <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <Button type="submit" loading={submitting} className="w-full">
                Send Offer
              </Button>
            </form>
          )}

          {/* Pending — waiting */}
          {existingOffer?.status === 'PENDING' && (
            <p className="text-xs text-slate-500 text-center">
              Your offer of <span className="font-mono text-slate-300">{formatCHF(parseFloat(existingOffer.price_chf))}</span> is waiting for a response.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
