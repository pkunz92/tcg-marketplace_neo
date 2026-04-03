import { useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Input from '../ui/Input'
import { useCreateOffer } from '../../hooks/useOffers'
import { formatCHF } from '../../lib/utils'
import toast from 'react-hot-toast'

export default function OfferModal({ listing, card, onClose }) {
  const [price, setPrice] = useState('')
  const [message, setMessage] = useState('')
  const createOffer = useCreateOffer()

  async function handleSubmit(e) {
    e.preventDefault()
    const offerPrice = parseFloat(price)
    if (!offerPrice || offerPrice <= 0) return toast.error('Enter a valid offer price')
    try {
      await createOffer.mutateAsync({
        listing: listing.id,
        offer_price_chf: offerPrice,
        message,
      })
      toast.success('Offer sent! The seller has 48 hours to respond.')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send offer')
    }
  }

  return (
    <Modal open title="Make an Offer" onClose={onClose} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-4 items-center bg-surface border border-border rounded-xl p-3">
          <img src={card?.image_url} alt={card?.card_name} className="w-14 rounded object-contain" />
          <div>
            <p className="font-medium text-slate-200">{card?.card_name}</p>
            <p className="text-sm text-slate-400">Listed at {formatCHF(listing.price_chf)}</p>
            <p className="text-xs text-slate-500 mt-0.5">Seller: {listing.seller_username}</p>
          </div>
        </div>

        <Input
          label="Your Offer Price (CHF)"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
          data-testid="offer-price"
        />

        <div>
          <label className="text-sm font-medium text-slate-300 block mb-1">Message (optional)</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add a note to the seller…"
            rows={3}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-accent-500 resize-none"
            data-testid="offer-message"
          />
        </div>

        <p className="text-xs text-slate-500 bg-elevated rounded-lg px-3 py-2">
          The seller has 48 hours to accept, decline, or counter your offer.
        </p>

        <div className="flex gap-3 justify-end pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={createOffer.isPending} data-testid="offer-submit">Send Offer</Button>
        </div>
      </form>
    </Modal>
  )
}
