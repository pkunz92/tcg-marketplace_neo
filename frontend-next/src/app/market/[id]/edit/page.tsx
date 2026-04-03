'use client'

import { useParams } from 'next/navigation'
import useSWR from 'swr'
import { api, type Listing } from '@/lib/api'
import ListingForm from '@/components/listing/ListingForm'
import Spinner from '@/components/ui/spinner'

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>()
  const { data: listing, isLoading } = useSWR<Listing>(
    id ? `listing-${id}` : null,
    () => api.get<Listing>(`/listings/${id}/`),
  )

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </main>
    )
  }

  if (!listing) {
    return (
      <main className="min-h-screen flex items-center justify-center text-slate-400">
        Listing not found.
      </main>
    )
  }

  return (
    <main className="min-h-screen px-4 py-8 max-w-2xl mx-auto">
      <ListingForm mode="edit" initialData={listing} />
    </main>
  )
}
