'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { api, type Review } from '@/lib/api'

interface ReviewFormProps {
  orderId: string
  onSuccess: (review: Review) => void
}

export default function ReviewForm({ orderId, onSuccess }: ReviewFormProps) {
  const [stars, setStars] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (stars === 0) {
      setError('Please select a star rating.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const review = await api.post<Review>(`/orders/${orderId}/review/`, { stars, comment })
      onSuccess(review)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit review.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const displayStars = hovered || stars

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="text-sm text-slate-400 mb-2">Your rating</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setStars(n)}
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(0)}
              className="focus:outline-none"
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
            >
              <Star
                size={28}
                className={
                  n <= displayStars
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-slate-600'
                }
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="review-comment" className="block text-sm text-slate-400 mb-1">
          Comment <span className="text-slate-600">(optional)</span>
        </label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={500}
          className="w-full bg-slate-800 border border-border rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:ring-1 focus:ring-accent-500"
          placeholder="Share your experience with this seller…"
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={submitting || stars === 0}
        className="w-full bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
      >
        {submitting ? 'Submitting…' : 'Submit Review'}
      </button>
    </form>
  )
}
