'use client'

import useSWR from 'swr'
import Link from 'next/link'
import Image from 'next/image'
import { BookHeart, ArrowUpRight, Trash2 } from 'lucide-react'
import { api, type WatchlistItem } from '@/lib/api'
import { formatCHF } from '@/lib/utils'
import Button from '@/components/ui/button'
import Spinner from '@/components/ui/spinner'
import { useToast } from '@/components/ui/toast'
import ProtectedRoute from '@/components/auth/protected-route'

const fetcher = () => api.get<WatchlistItem[]>('/watchlist/')


function WatchlistContent() {
  const { data, isLoading, mutate } = useSWR('watchlist', fetcher)
  const { toast } = useToast()
  const items: WatchlistItem[] = data ?? []

  async function removeItem(id: string) {
    try {
      await api.delete(`/watchlist/${id}/`)
      toast('Removed from watchlist', 'success')
      mutate()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove'
      toast(msg, 'error')
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <BookHeart size={22} className="text-accent-400" />
        <h1 className="text-2xl font-bold text-slate-100">Watchlist</h1>
        {items.length > 0 && (
          <span className="text-xs bg-elevated border border-border px-2 py-0.5 rounded-full text-slate-400">
            {items.length}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-500">
          <BookHeart size={40} className="opacity-40" />
          <p className="text-sm">Your watchlist is empty.</p>
          <Link href="/market">
            <Button variant="secondary" size="sm">Browse listings</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const listing = item.listing
            return (
              <div
                key={item.id}
                className="flex items-center gap-4 bg-surface border border-border rounded-xl p-4"
              >
                {/* Card image */}
                <div className="relative w-12 h-[67px] shrink-0">
                  <Image
                    src={listing.card_image_url || '/placeholder-card.png'}
                    alt={listing.card_name}
                    fill
                    className="object-contain rounded"
                    sizes="48px"
                  />
                </div>

                {/* Card info */}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-200 truncate">{listing.card_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{listing.set_name}</p>
                  <p className="text-xs text-slate-500">
                    Condition: {listing.condition} · Seller: {listing.seller_username}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <p className="font-mono text-accent-400 font-semibold">
                    {formatCHF(listing.price_chf)}
                  </p>
                  <div className="flex items-center gap-1">
                    <Link href={`/market/${listing.id}`}>
                      <button className="inline-flex items-center gap-1 text-xs text-accent-400 hover:text-accent-300 transition-colors">
                        View <ArrowUpRight size={11} />
                      </button>
                    </Link>
                    <span className="text-slate-700">·</span>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={11} />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function WatchlistPage() {
  return (
    <ProtectedRoute>
      <WatchlistContent />
    </ProtectedRoute>
  )
}
