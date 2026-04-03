import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'
import { ToastProvider } from '@/components/ui/toast'
import Navbar from '@/components/layout/navbar'

export const metadata: Metadata = {
  title: 'TCG Marketplace',
  description: 'Trade Pokémon cards — fast, safe, worldwide.',
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
