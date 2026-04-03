'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ShoppingBag,
  BookHeart,
  LogOut,
  LogIn,
  Loader2,
} from 'lucide-react'

const navLinks = [
  { href: '/market', label: 'Market' },
  { href: '/cards', label: 'Cards' },
]

const authLinks = [
  { href: '/dashboard/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/watchlist', label: 'Watchlist', icon: BookHeart },
  { href: '/dashboard/seller', label: 'Dashboard', icon: LayoutDashboard },
]

export default function Navbar() {
  const { user, loading, logout } = useAuth()
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-accent-400 shrink-0">
          TCG Market
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                pathname.startsWith(l.href)
                  ? 'bg-accent-500/20 text-accent-400'
                  : 'text-slate-400 hover:text-slate-200',
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {loading ? (
            <Loader2 size={18} className="animate-spin text-slate-500" />
          ) : user ? (
            <>
              {authLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    'hidden sm:inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    pathname.startsWith(l.href)
                      ? 'bg-accent-500/20 text-accent-400'
                      : 'text-slate-400 hover:text-slate-200',
                  )}
                >
                  <l.icon size={14} />
                  {l.label}
                </Link>
              ))}
              <span className="hidden sm:block text-xs text-slate-500 border-l border-border pl-3 ml-1">
                {user.username}
              </span>
              <button
                onClick={logout}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-600 transition-colors"
            >
              <LogIn size={14} />
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
