import type { NextConfig } from 'next'

// BACKEND_URL can be a full URL (http://localhost:8000) or just a hostname
// (e.g. from Render's fromService.property: host). Normalise to full URL.
const rawBackend = process.env.BACKEND_URL ?? 'http://localhost:8000'
const backendBase = /^https?:\/\//.test(rawBackend) ? rawBackend : `https://${rawBackend}`

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendBase}/api/:path*`,
      },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.pokemontcg.io' },
      { protocol: 'https', hostname: 'assets.tcgdex.net' },
      { protocol: 'https', hostname: '**.onrender.com' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
    ],
  },
}

export default nextConfig
