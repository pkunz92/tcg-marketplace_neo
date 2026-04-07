'use client'

import useSWR from 'swr'
import { useParams } from 'next/navigation'
import { Star, UserCircle } from 'lucide-react'
import { api, type SellerProfile, type Review } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import Spinner from '@/components/ui/spinner'
import SellerRepBadge from '@/components/ui/seller-rep-badge'
import ListingCard from '@/components/listing/ListingCard'

const fetchProfile = (id: string) => api.get<SellerProfile>(`/sellers/${id}/`)
const fetchReviews = (id: string) => api.get<Review[]>(`/users/${id}/reviews/`)

function StarRow({ stars }: { stars: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={13}
          className={n <= stars ? 'fill-yellow-400 text-yellow-400' : 'text-slate-600'}
        />
      ))}
    </span>
  )
}

export default function SellerProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { data: profile, isLoading: profileLoading } = useSWR(
    id ? `seller-profile-${id}` : null,
    () => fetchProfile(id),
  )
  const { data: reviews, isLoading: reviewsLoading } = useSWR(
    id ? `seller-reviews-${id}` : null,
    () => fetchReviews(id),
  )

  if (profileLoading) {
    return (
      <div className="flex justify-center py-32">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!profile) {
    return <p className="text-slate-400 text-center py-32">Seller not found.</p>
  }

  const { reputation } = profile

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Profile header */}
      <div className="bg-surface border border-border rounded-2xl p-6 flex items-center gap-5">
        <div className="text-slate-600">
          <UserCircle size={56} />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-100">{profile.seller_username}</h1>
          <div className="mt-1.5">
            <SellerRepBadge
              score={reputation.score}
              totalReviews={reputation.total_reviews}
              size="md"
            />
          </div>
          {reputation.total_reviews > 0 && (
            <p className="text-xs text-slate-500 mt-1">
              {reputation.recent_reviews} review{reputation.recent_reviews !== 1 ? 's' : ''} in the last 90 days
            </p>
          )}
        </div>
      </div>

      {/* Active listings */}
      <section>
        <h2 className="text-base font-semibold text-slate-200 mb-4">
          Active Listings
          <span className="ml-2 text-sm font-normal text-slate-500">
            ({profile.active_listings.length})
          </span>
        </h2>
        {profile.active_listings.length === 0 ? (
          <p className="text-slate-500 text-sm">No active listings.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {profile.active_listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>

      {/* Reviews */}
      <section>
        <h2 className="text-base font-semibold text-slate-200 mb-4">
          Reviews
          <span className="ml-2 text-sm font-normal text-slate-500">
            ({reputation.total_reviews})
          </span>
        </h2>
        {reviewsLoading && (
          <div className="flex justify-center py-8">
            <Spinner size="md" />
          </div>
        )}
        {!reviewsLoading && (!reviews || reviews.length === 0) && (
          <p className="text-slate-500 text-sm">No reviews yet.</p>
        )}
        {reviews && reviews.length > 0 && (
          <div className="space-y-3">
            {reviews.map((review) => (
              <div key={review.id} className="bg-surface border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <StarRow stars={review.stars} />
                    <span className="text-xs text-slate-500">by {review.reviewer_username}</span>
                  </div>
                  <span className="text-xs text-slate-600">{formatDate(review.created_at)}</span>
                </div>
                {review.card_name && (
                  <p className="text-xs text-slate-500 mb-1">re: {review.card_name}</p>
                )}
                {review.comment && (
                  <p className="text-sm text-slate-300">{review.comment}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
