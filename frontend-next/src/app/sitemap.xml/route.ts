import { NextResponse } from 'next/server'

export const revalidate = 3600

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tcgmarketplace.example.com'

interface Listing {
  id: string
  updated_at?: string
  created_at: string
}

interface PaginatedResponse {
  results: Listing[]
  count: number
  next: string | null
}

async function fetchAllListingIds(): Promise<Listing[]> {
  const listings: Listing[] = []
  const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8000'
  let url: string | null = `${backendUrl}/api/listings/?page_size=500&is_available=true`

  while (url) {
    try {
      const res = await fetch(url, { next: { revalidate: 3600 } })
      if (!res.ok) break
      const data: PaginatedResponse = await res.json()
      listings.push(...(data.results ?? []))
      url = data.next
    } catch {
      break
    }
  }
  return listings
}

function xmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const staticPages = [
    { loc: '/', priority: '1.0', changefreq: 'daily' },
    { loc: '/market', priority: '0.9', changefreq: 'hourly' },
    { loc: '/about', priority: '0.7', changefreq: 'monthly' },
    { loc: '/how-it-works', priority: '0.7', changefreq: 'monthly' },
    { loc: '/pricing', priority: '0.7', changefreq: 'monthly' },
    { loc: '/blog', priority: '0.8', changefreq: 'weekly' },
  ]

  const listings = await fetchAllListingIds()

  const urls = [
    ...staticPages.map(
      (p) => `
  <url>
    <loc>${xmlEscape(BASE_URL + p.loc)}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`,
    ),
    ...listings.map(
      (l) => `
  <url>
    <loc>${xmlEscape(`${BASE_URL}/market/${l.id}`)}</loc>
    <lastmod>${new Date(l.updated_at ?? l.created_at).toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`,
    ),
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}
</urlset>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
