import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { useProfile } from '../../hooks/useProfile'
import { useCreateOrder } from '../../hooks/useOrders'
import { formatCHF, CONDITION_LABELS } from '../../lib/utils'
import toast from 'react-hot-toast'
import { useState } from 'react'

export default function BuyModal({ listing, card, onClose }) {
  const { data: profile } = useProfile()
  const createOrder = useCreateOrder()
  const [qty, setQty] = useState(1)

  async function handleBuy() {
    try {
      await createOrder.mutateAsync({
        listing: listing.id,
        quantity: qty,
        shipping_name: profile?.shipping_name || '',
        shipping_address_line1: profile?.shipping_address_line1 || '',
        shipping_city: profile?.shipping_city || '',
        shipping_postal_code: profile?.shipping_postal_code || '',
        shipping_country: profile?.shipping_country || '',
      })
      toast.success('Order placed!')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to place order')
    }
  }

  const cond = CONDITION_LABELS[listing.condition] || { label: listing.condition, color: 'text-slate-400' }

  return (
    <Modal open title="Confirm Purchase" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex gap-4">
          <img src={card?.image_url} alt={card?.card_name} className="w-20 rounded-lg object-contain" />
          <div>
            <p className="font-semibold text-slate-100">{card?.card_name}</p>
            <p className="text-sm text-slate-400">{listing.seller_username}</p>
            <p className={`text-sm mt-1 ${cond.color}`}>{cond.label}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-400">Quantity</label>
          <input
            type="number"
            min={1}
            max={listing.quantity}
            value={qty}
            onChange={(e) => setQty(Math.min(Number(e.target.value), listing.quantity))}
            className="w-20 bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-accent-500"
            data-testid="buy-qty"
          />
          <span className="text-xs text-slate-500">(max {listing.quantity})</span>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Price per card</span>
            <span className="font-mono text-slate-200">{formatCHF(listing.price_chf)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2">
            <span className="text-slate-300 font-medium">Total</span>
            <span className="font-mono text-accent-400 font-semibold">{formatCHF(listing.price_chf * qty)}</span>
          </div>
        </div>

        {profile?.shipping_city ? (
          <div className="text-xs text-slate-500 bg-elevated rounded-lg p-3">
            Ship to: {profile.shipping_name}, {profile.shipping_city}, {profile.shipping_country}
          </div>
        ) : (
          <p className="text-xs text-yellow-500">Complete your shipping address in your profile first.</p>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleBuy}
            loading={createOrder.isPending}
            disabled={!profile?.shipping_city}
            data-testid="buy-confirm-btn"
          >
            Confirm Order
          </Button>
        </div>
      </div>
    </Modal>
  )
}
