import { NextResponse } from 'next/server'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tcgmarketplace.example.com'

export function GET() {
  const content = `User-agent: *
Allow: /

# Don't index auth or private pages
Disallow: /login
Disallow: /register
Disallow: /checkout/
Disallow: /dashboard/
Disallow: /market/new
Disallow: /watchlist

Sitemap: ${BASE_URL}/sitemap.xml
`

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, s-maxage=86400',
    },
  })
}
