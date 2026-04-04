'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import {
  LayoutDashboard,
  ShoppingBag,
  BookHeart,
  LogOut,
  LogIn,
  Loader2,
  Search,
  Plus,
  Menu,
  X,
} from 'lucide-react'

const navLinks = [
  { href: '/market', label: 'Market' },
]

const authLinks = [
  { href: '/dashboard/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/watchlist', label: 'Watchlist', icon: BookHeart },
  { href: '/dashboard/seller', label: 'Dashboard', icon: LayoutDashboard },
]

export default function Navbar() {
  const { user, loading, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchVal, setSearchVal] = useState('')

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (searchVal.trim()) {
      router.push(`/market?search=${encodeURIComponent(searchVal.trim())}`)
      setSearchVal('')
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">

        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 shrink-0 group">
          <div className="w-7 h-7 rounded-lg bg-accent-gradient flex items-center justify-center shadow-glow-sm group-hover:shadow-glow-accent transition-shadow">
            <span className="text-white text-xs font-black">T</span>
          </div>
          <span className="text-base font-black text-slate-100 hidden sm:block">
            TCG <span className="text-accent-400">Market</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-0.5">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                pathname.startsWith(l.href)
                  ? 'bg-accent-500/15 text-accent-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-elevated',
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="hidden sm:flex flex-1 max-w-sm">
          <div className="relative w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              placeholder="Search cards…"
              className="w-full bg-elevated border border-border rounded-lg pl-8 pr-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-colors"
            />
          </div>
        </form>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2">
          {loading ? (
            <Loader2 size={16} className="animate-spin text-slate-500" />
          ) : user ? (
            <>
              {/* Auth links - desktop */}
              <div className="hidden lg:flex items-center gap-0.5">
                {authLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                      pathname.startsWith(l.href)
                        ? 'bg-accent-500/15 text-accent-400'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-elevated',
                    )}
                  >
                    <l.icon size={13} />
                    {l.label}
                  </Link>
                ))}
              </div>

              {/* Sell CTA */}
              <Link
                href="/market/new"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-accent-gradient px-3 py-1.5 text-sm font-semibold text-white shadow-glow-sm hover:shadow-glow-accent transition-all"
              >
                <Plus size={13} /> Sell
              </Link>

              {/* User chip */}
              <span className="hidden md:block text-xs text-slate-500 border-l border-border pl-3 ml-1 max-w-[100px] truncate">
                {user.username}
              </span>

              <button
                onClick={logout}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 hover:bg-elevated transition-colors"
                title="Logout"
              >
                <LogOut size={14} />
                <span className="hidden md:inline">Logout</span>
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-gradient px-4 py-1.5 text-sm font-semibold text-white shadow-glow-sm hover:shadow-glow-accent transition-all"
            >
              <LogIn size={13} />
              Sign in
            </Link>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-elevated transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-surface/95 backdrop-blur-md px-4 py-4 flex flex-col gap-2 animate-slide-up">
          {/* Mobile search */}
          <form onSubmit={(e) => { handleSearch(e); setMobileOpen(false) }} className="mb-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                placeholder="Search cards…"
                className="w-full bg-elevated border border-border rounded-xl pl-8 pr-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent-500/50 transition-colors"
              />
            </div>
          </form>

          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
                pathname.startsWith(l.href)
                  ? 'bg-accent-500/15 text-accent-400'
                  : 'text-slate-300 hover:bg-elevated',
              )}
            >
              {l.label}
            </Link>
          ))}

          {user && (
            <>
              {authLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
                    pathname.startsWith(l.href)
                      ? 'bg-accent-500/15 text-accent-400'
                      : 'text-slate-300 hover:bg-elevated',
                  )}
                >
                  <l.icon size={15} />
                  {l.label}
                </Link>
              ))}
              <Link
                href="/market/new"
                onClick={() => setMobileOpen(false)}
                className="inline-flex items-center gap-2 rounded-xl bg-accent-gradient px-4 py-2.5 text-sm font-semibold text-white mt-1"
              >
                <Plus size={15} /> Sell a Card
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  )
}
