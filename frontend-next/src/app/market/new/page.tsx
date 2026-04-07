'use client'

import ListingForm from '@/components/listing/ListingForm'
import ProtectedRoute from '@/components/auth/protected-route'

export default function NewListingPage() {
  return (
    <ProtectedRoute>
      <main className="min-h-screen px-4 py-8 max-w-2xl mx-auto">
        <ListingForm mode="create" />
      </main>
    </ProtectedRoute>
  )
}
