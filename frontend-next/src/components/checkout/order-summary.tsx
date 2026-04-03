import type { Listing } from '@/lib/api'
import { formatCHF } from '@/lib/utils'
import Image from 'next/image'

interface OrderSummaryProps {
  listing: Listing
  qty: number
  onQtyChange: (qty: number) => void
}

export default function OrderSummary({ listing, qty, onQtyChange }: OrderSummaryProps) {
  const total = listing.price_chf * qty

  return (
    <div className="bg-surface border border-border rounded-2xl p-5 sticky top-20">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
        Order Summary
      </h3>

      <div className="flex gap-3 mb-5">
        <div className="relative w-14 shrink-0" style={{ aspectRatio: '63/88' }}>
          <Image
            src={listing.card_image_url || '/placeholder-card.png'}
            alt={listing.card_name}
            fill
            className="object-contain rounded-lg"
            sizes="56px"
          />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-200 truncate">{listing.card_name}</p>
          <p className="text-xs text-slate-400 mt-0.5 truncate">{listing.set_name}</p>
          <p className="text-xs text-slate-500 mt-0.5">Condition: {listing.condition}</p>
          <p className="text-xs text-slate-500">Seller: {listing.seller_username}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-5">
        <label className="text-xs text-slate-400">Qty</label>
        <input
          type="number"
          min={1}
          max={listing.quantity}
          value={qty}
          onChange={(e) =>
            onQtyChange(Math.max(1, Math.min(Number(e.target.value), listing.quantity)))
          }
          className="w-16 rounded-lg border border-border bg-elevated px-2 py-1 text-sm text-slate-100 text-center focus:outline-none focus:border-accent-500"
        />
        <span className="text-xs text-slate-500">/ {listing.quantity} avail.</span>
      </div>

      <div className="border-t border-border pt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">
            {formatCHF(listing.price_chf)} × {qty}
          </span>
          <span className="font-mono text-slate-200">{formatCHF(listing.price_chf * qty)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Shipping</span>
          <span className="text-slate-500 italic text-xs">Arranged by seller</span>
        </div>
        <div className="flex justify-between border-t border-border pt-2">
          <span className="font-semibold text-slate-200">Total</span>
          <span className="font-mono text-accent-400 font-bold text-base">
            {formatCHF(total)}
          </span>
        </div>
      </div>
    </div>
  )
}
