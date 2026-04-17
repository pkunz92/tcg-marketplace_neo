'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Tag, X, Check, ArrowRight } from 'lucide-react'
import { api, type Offer, type OfferStatus, type PaginatedResponse } from '@/lib/api'
import { formatCHF, formatDate, cn } from '@/lib/utils'
import Badge from '@/components/ui/badge'
import Button from '@/components/ui/button'
import Spinner from '@/components/ui/spinner'
import ProtectedRoute from '@/components/auth/protected-route'
import { useToast } from '@/components/ui/toast'

type View = 'received' | 'sent'

const STATUS_VARIANT: Record<OfferStatus, 'warning' | 'success' | 'danger' | 'default' | 'info'> = {
  PENDING:   'warning',
  COUNTERED: 'info',
  ACCEPTED:  'success',
  DECLINED:  'danger',
  EXPIRED:   'default',
}

// ---------------------------------------------------------------------------
// Counter modal
// ---------------------------------------------------------------------------

interface CounterModalProps {
  offerId: number
  onClose: () => void
  onSuccess: () => void
}

function CounterModal({ offerId, onClose, onSuccess }: CounterModalProps) {
  const { toast } = useToast()
  const [price, setPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const num = parseFloat(price)
    if (isNaN(num) || num <= 0) return
    setSubmitting(true)
    try {
      await api.patch(`/offers/${offerId}/`, { status: 'COUNTERED', counter_price_chf: num.toFixed(2) })
      toast('Counter-offer sent', 'success')
      onSuccess()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to counter', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-100 text-sm">Counter Offer</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Your counter price (CHF)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-mono">CHF</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={price}
                onChange={e => setPrice(e.target.value)}
                data-testid="counter-price"
                className="w-full bg-elevated border border-border rounded-lg pl-12 pr-3 py-2 text-sm font-mono text-slate-200 focus:outline-none focus:border-accent-500"
                placeholder="0.00"
                required
              />
            </div>
          </div>
          <Button type="submit" loading={submitting} className="w-full" data-testid="counter-submit">
            Send Counter
          </Button>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Offer row
// ---------------------------------------------------------------------------

interface OfferRowProps {
  offer: Offer & { card_name?: string; listing_price_chf?: string }
  view: View
  onAction: () => void
}

function OfferRow({ offer, view, onAction }: OfferRowProps) {
  const { toast } = useToast()
  const [showCounter, setShowCounter] = useState(false)
  const [acting, setActing] = useState(false)

  const isPending = offer.status === 'PENDING'
  const isCountered = offer.status === 'COUNTERED'
  const canAct = view === 'received' && (isPending || isCountered)

  async function respond(status: 'ACCEPTED' | 'DECLINED') {
    setActing(true)
    try {
      await api.patch(`/offers/${offer.id}/`, { status })
      toast(status === 'ACCEPTED' ? 'Offer accepted' : 'Offer declined', status === 'ACCEPTED' ? 'success' : 'error')
      onAction()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed', 'error')
    } finally {
      setActing(false)
    }
  }

  return (
    <div data-testid="offer-row" className="bg-surface border border-border rounded-xl px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-200 truncate">
            {offer.card_name ?? `Listing #${offer.listing}`}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {view === 'received' ? `From: ${offer.buyer_username}` : ''} · {formatDate(offer.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-mono text-sm font-semibold text-accent-400">{formatCHF(parseFloat(offer.offer_price_chf))}</span>
          <Badge variant={STATUS_VARIANT[offer.status]}>{offer.status}</Badge>
        </div>
      </div>

      {offer.counter_price_chf && (
        <p className="text-xs text-slate-400">
          Counter: <span className="font-mono text-slate-200">{formatCHF(parseFloat(offer.counter_price_chf))}</span>
        </p>
      )}

      {canAct && (
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            onClick={() => respond('ACCEPTED')}
            loading={acting}
            data-testid="offer-accept-btn"
          >
            <Check size={12} /> Accept
          </Button>
          {isPending && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowCounter(true)}
              data-testid="offer-counter-btn"
            >
              <ArrowRight size={12} /> Counter
            </Button>
          )}
          <Button
            size="sm"
            variant="destructive"
            onClick={() => respond('DECLINED')}
            loading={acting}
            data-testid="offer-decline-btn"
          >
            <X size={12} /> Decline
          </Button>
        </div>
      )}

      {showCounter && (
        <CounterModal
          offerId={offer.id}
          onClose={() => setShowCounter(false)}
          onSuccess={() => { setShowCounter(false); onAction() }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page content
// ---------------------------------------------------------------------------

type OfferWithCard = Offer & { card_name?: string; listing_price_chf?: string }

function OffersContent() {
  const [view, setView] = useState<View>('received')

  const { data: receivedData, isLoading: loadingReceived, mutate: mutateReceived } = useSWR(
    'offers-received',
    () => api.get<PaginatedResponse<OfferWithCard> | OfferWithCard[]>('/offers/?as_seller=true'),
  )
  const { data: sentData, isLoading: loadingSent, mutate: mutateSent } = useSWR(
    'offers-sent',
    () => api.get<PaginatedResponse<OfferWithCard> | OfferWithCard[]>('/offers/'),
  )

  const received: OfferWithCard[] = Array.isArray(receivedData) ? receivedData : (receivedData?.results ?? [])
  const sent: OfferWithCard[] = Array.isArray(sentData) ? sentData : (sentData?.results ?? [])

  const offers = view === 'received' ? received : sent
  const isLoading = view === 'received' ? loadingReceived : loadingSent
  const refetch = view === 'received' ? mutateReceived : mutateSent

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-100 mb-6">Offers</h1>

      {/* Tab bar */}
      <div className="flex gap-0.5 mb-6 bg-surface border border-border rounded-xl p-1 w-fit">
        {(['received', 'sent'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg capitalize transition-all',
              view === v
                ? 'bg-accent-500/20 text-accent-300'
                : 'text-slate-500 hover:text-slate-200 hover:bg-elevated',
            )}
          >
            {v === 'received' ? 'Received' : 'Sent'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : offers.length === 0 ? (
        <div className="text-center py-20 text-slate-500 text-sm">
          <Tag size={32} className="mx-auto mb-3 opacity-30" />
          <p>No {view} offers yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {offers.map((o) => (
            <OfferRow key={o.id} offer={o} view={view} onAction={() => refetch()} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function OffersPage() {
  return (
    <ProtectedRoute>
      <OffersContent />
    </ProtectedRoute>
  )
}
