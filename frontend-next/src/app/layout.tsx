import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'
import { ToastProvider } from '@/components/ui/toast'
import Navbar from '@/components/layout/navbar'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tcgmarketplace.example.com'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'TCG Marketplace — Buy & Sell Pokémon Cards',
    template: '%s | TCG Marketplace',
  },
  description:
    'The trusted marketplace to buy and sell Pokémon TCG cards. AI pre-grading, photo verification, fast payouts. Serving collectors in 40+ countries.',
  openGraph: {
    type: 'website',
    siteName: 'TCG Marketplace',
    title: 'TCG Marketplace — Buy & Sell Pokémon Cards',
    description:
      'The trusted marketplace to buy and sell Pokémon TCG cards. AI pre-grading, photo verification, fast payouts.',
    url: BASE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TCG Marketplace — Buy & Sell Pokémon Cards',
    description:
      'The trusted marketplace to buy and sell Pokémon TCG cards. Fast, safe, worldwide.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
    },
  },
  alternates: {
    canonical: BASE_URL,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-base text-slate-100 antialiased">
        <AuthProvider>
          <ToastProvider>
            <Navbar />
            <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
