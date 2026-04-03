import ListingForm from '@/components/listing/ListingForm'

export const metadata = { title: 'New Listing — TCG Marketplace' }

export default function NewListingPage() {
  return (
    <main className="min-h-screen px-4 py-8 max-w-2xl mx-auto">
      <ListingForm mode="create" />
    </main>
  )
}
