import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'TCG Marketplace listing'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

interface Listing {
  card_name: string
  set_name: string
  condition: string
  price_chf: number
  card_image_url: string
}

export default async function OGImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let listing: Listing | null = null
  try {
    const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8000'
    const res = await fetch(`${backendUrl}/api/listings/${id}/`, {
      next: { revalidate: 3600 },
    })
    if (res.ok) {
      listing = await res.json()
    }
  } catch {
    // fallback to generic image
  }

  const cardName = listing?.card_name ?? 'Trading Card'
  const setName = listing?.set_name ?? ''
  const condition = listing?.condition ?? ''
  const priceFormatted = listing
    ? `CHF ${Number(listing.price_chf).toFixed(2)}`
    : ''

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          padding: '60px',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Glow accent top-right */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '400px',
            height: '400px',
            background: 'radial-gradient(ellipse, rgba(139,92,246,0.25) 0%, transparent 70%)',
          }}
        />

        {/* Left: text content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            flex: 1,
            paddingRight: listing?.card_image_url ? '40px' : '0',
          }}
        >
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '18px',
                fontWeight: 900,
              }}
            >
              T
            </div>
            <span style={{ color: '#94a3b8', fontSize: '16px', fontWeight: 600 }}>
              TCG Marketplace
            </span>
          </div>

          {/* Card info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div
              style={{
                fontSize: '52px',
                fontWeight: 900,
                color: 'white',
                lineHeight: 1.1,
                maxWidth: '650px',
              }}
            >
              {cardName}
            </div>
            {setName && (
              <div style={{ fontSize: '22px', color: '#94a3b8', fontWeight: 500 }}>
                {setName}
                {condition ? ` · ${condition}` : ''}
              </div>
            )}
          </div>

          {/* Price */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {priceFormatted && (
              <div
                style={{
                  fontSize: '36px',
                  fontWeight: 900,
                  background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                {priceFormatted}
              </div>
            )}
            <div
              style={{
                background: 'rgba(139,92,246,0.15)',
                border: '1px solid rgba(139,92,246,0.3)',
                borderRadius: '8px',
                padding: '6px 16px',
                color: '#a78bfa',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              Buy Now
            </div>
          </div>
        </div>

        {/* Right: card image */}
        {listing?.card_image_url && (
          <div
            style={{
              width: '260px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={listing.card_image_url}
              alt={cardName}
              style={{
                maxHeight: '430px',
                maxWidth: '260px',
                objectFit: 'contain',
                borderRadius: '16px',
                boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
              }}
            />
          </div>
        )}
      </div>
    ),
    {
      ...size,
    },
  )
}
