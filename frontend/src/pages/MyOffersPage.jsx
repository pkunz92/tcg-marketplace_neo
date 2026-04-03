import { useState } from 'react'
import { useMyOffers, useAcceptOffer, useDeclineOffer, useCounterOffer } from '../hooks/useOffers'
import PageContainer from '../components/layout/PageContainer'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import { Tag, Clock } from 'lucide-react'
import { formatCHF, formatDate } from '../lib/utils'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const STATUS_STYLES = {
  PENDING:   { label: 'Pending',   cls: 'bg-yellow-950 text-yellow-400 border-yellow-800' },
  ACCEPTED:  { label: 'Accepted',  cls: 'bg-green-950 text-green-400 border-green-800' },
  DECLINED:  { label: 'Declined',  cls: 'bg-red-950 text-red-400 border-red-800' },
  EXPIRED:   { label: 'Expired',   cls: 'bg-slate-800 text-slate-400 border-slate-700' },
  COUNTERED: { label: 'Countered', cls: 'bg-blue-950 text-blue-400 border-blue-800' },
}

function CounterModal({ offer, onClose }) {
  const [price, setPrice] = useState(String(offer.offer_price_chf))
  const counterOffer = useCounterOffer()

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      await counterOffer.mutateAsync({ id: offer.id, counter_price_chf: parseFloat(price) })
      toast.success('Counter-offer sent!')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send counter-offer')
    }
  }

  return (
    <Modal open title="Counter Offer" onClose={onClose} maxWidth="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-400">
          Buyer offered {formatCHF(offer.offer_price_chf)}. Enter your counter price:
        </p>
        <Input
          label="Counter Price (CHF)"
          type="number"
          step="0.01"
          min="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={counterOffer.isPending}>Send Counter</Button>
        </div>
      </form>
    </Modal>
  )
}

function OfferRow({ offer, isSeller }) {
  const [counterOpen, setCounterOpen] = useState(false)
  const acceptOffer = useAcceptOffer()
  const declineOffer = useDeclineOffer()

  const statusMeta = STATUS_STYLES[offer.status] || { label: offer.status, cls: 'bg-slate-800 text-slate-400 border-slate-700' }
  const expiresAt = new Date(offer.expires_at)
  const isExpired = expiresAt < new Date()
  const hoursLeft = Math.max(0, Math.round((expiresAt - new Date()) / 3600000))

  async function handleAccept() {
    try {
      await acceptOffer.mutateAsync(offer.id)
      toast.success('Offer accepted! Order created.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to accept offer')
    }
  }

  async function handleDecline() {
    try {
      await declineOffer.mutateAsync(offer.id)
      toast.success('Offer declined.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to decline offer')
    }
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-4">
      <div className="flex items-start gap-4 flex-wrap">
        {/* Card image */}
        <img
          src={offer.card_image_url || offer.listing_card_image_url}
          alt={offer.card_name || offer.listing_card_name}
          className="w-14 rounded-lg object-contain shrink-0"
          style={{ aspectRatio: '63/88' }}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-slate-200 truncate">
              {offer.card_name || offer.listing_card_name || `Listing #${offer.listing}`}
            </p>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusMeta.cls}`}>
              {statusMeta.label}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 mt-2 text-sm">
            <div>
              <span className="text-slate-500 text-xs">Offer</span>
              <p className="font-mono text-accent-400 font-semibold">{formatCHF(offer.offer_price_chf)}</p>
            </div>
            {offer.counter_price_chf && (
              <div>
                <span className="text-slate-500 text-xs">Counter</span>
                <p className="font-mono text-blue-400 font-semibold">{formatCHF(offer.counter_price_chf)}</p>
              </div>
            )}
            <div>
              <span className="text-slate-500 text-xs">{isSeller ? 'Buyer' : 'Seller'}</span>
              <p className="text-slate-300 text-sm">{isSeller ? offer.buyer_username : offer.seller_username}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">Created</span>
              <p className="text-slate-400 text-xs">{formatDate(offer.created_at)}</p>
            </div>
          </div>

          {offer.message && (
            <p className="text-xs text-slate-500 mt-2 italic">"{offer.message}"</p>
          )}

          {offer.status === 'PENDING' && !isExpired && (
            <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
              <Clock size={11} />
              <span>{hoursLeft}h remaining</span>
            </div>
          )}
        </div>

        {/* Actions — only for seller on pending offers */}
        {isSeller && offer.status === 'PENDING' && !isExpired && (
          <div className="flex gap-2 flex-wrap shrink-0">
            <Button size="sm" onClick={handleAccept} loading={acceptOffer.isPending}>Accept</Button>
            <Button size="sm" variant="secondary" onClick={() => setCounterOpen(true)}>Counter</Button>
            <Button size="sm" variant="danger" onClick={handleDecline} loading={declineOffer.isPending}>Decline</Button>
          </div>
        )}
      </div>

      {counterOpen && <CounterModal offer={offer} onClose={() => setCounterOpen(false)} />}
    </div>
  )
}

export default function MyOffersPage() {
  const { data, isLoading } = useMyOffers()
  const { user } = useAuth()
  const [view, setView] = useState('received') // 'received' | 'sent'

  const offers = data?.results || data || []

  // Split into received (as seller) vs sent (as buyer)
  const receivedOffers = offers.filter((o) => o.seller_username === user?.username)
  const sentOffers = offers.filter((o) => o.buyer_username === user?.username)
  const displayed = view === 'received' ? receivedOffers : sentOffers

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-100">My Offers</h1>
        <div className="flex gap-1 bg-surface border border-border rounded-xl p-1">
          {[
            { key: 'received', label: `Received (${receivedOffers.length})` },
            { key: 'sent',     label: `Sent (${sentOffers.length})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                view === key ? 'bg-accent-500 text-base' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : displayed.length === 0 ? (
        <EmptyState
          icon={Tag}
          title={view === 'received' ? 'No offers received' : 'No offers sent'}
          description={view === 'received' ? 'Offers from buyers on your listings will appear here.' : 'Offers you have made will appear here.'}
        />
      ) : (
        <div className="space-y-3">
          {displayed.map((o) => (
            <OfferRow key={o.id} offer={o} isSeller={view === 'received'} />
          ))}
        </div>
      )}
    </PageContainer>
  )
}
