import type { Metadata } from 'next'
import ListingDetailClient from './ListingDetailClient'

interface Listing {
  id: string
  card_name: string
  set_name: string
  condition: string
  price_chf: number
  card_image_url: string
  seller_username: string
  card_rarity?: string
  is_available: boolean
}

async function fetchListing(id: string): Promise<Listing | null> {
  try {
    const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8000'
    const res = await fetch(`${backendUrl}/api/listings/${id}/`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const listing = await fetchListing(id)

  if (!listing) {
    return {
      title: 'Listing Not Found | TCG Marketplace',
      description: 'This card listing could not be found on TCG Marketplace.',
    }
  }

  const title = `${listing.card_name} (${listing.condition}) — CHF ${Number(listing.price_chf).toFixed(2)} | TCG Marketplace`
  const description = `Buy ${listing.card_name} from ${listing.set_name ?? 'TCG'} in ${listing.condition} condition for CHF ${Number(listing.price_chf).toFixed(2)}. Sold by ${listing.seller_username} on TCG Marketplace.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: [
        {
          url: `/market/${id}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: listing.card_name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

function buildJsonLd(listing: Listing) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.card_name,
    description: `${listing.card_name} from ${listing.set_name ?? 'TCG'} in ${listing.condition} condition.`,
    image: listing.card_image_url,
    brand: {
      '@type': 'Brand',
      name: 'Pokémon TCG',
    },
    offers: {
      '@type': 'Offer',
      price: String(listing.price_chf),
      priceCurrency: 'CHF',
      availability: listing.is_available
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Person',
        name: listing.seller_username,
      },
    },
  }
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const listing = await fetchListing(id)

  return (
    <>
      {listing && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildJsonLd(listing)),
          }}
        />
      )}
      <ListingDetailClient />
    </>
  )
}
