import Link from 'next/link'

const LINKS = {
  Marketplace: [
    { href: '/market', label: 'Browse Market' },
    { href: '/cards', label: 'Card Catalog' },
    { href: '/market/new', label: 'Sell a Card' },
    { href: '/pricing', label: 'Pricing & Fees' },
  ],
  Account: [
    { href: '/dashboard/seller', label: 'Seller Dashboard' },
    { href: '/dashboard/orders', label: 'My Orders' },
    { href: '/watchlist', label: 'Watchlist' },
    { href: '/register', label: 'Create Account' },
  ],
  Company: [
    { href: '/about', label: 'About Us' },
    { href: '/how-it-works', label: 'How It Works' },
    { href: '/blog', label: 'Blog' },
    { href: '/sellers', label: 'Seller Directory' },
  ],
}

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-border bg-surface/60">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-accent-gradient flex items-center justify-center">
                <span className="text-white text-xs font-black">T</span>
              </div>
              <span className="text-base font-black text-slate-100">
                TCG <span className="text-accent-400">Market</span>
              </span>
            </Link>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
              The premium Pokémon TCG marketplace with AI grading, photo verification, and worldwide shipping.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([section, links]) => (
            <div key={section}>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{section}</p>
              <ul className="space-y-2">
                {links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-slate-500 hover:text-slate-200 transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} TCG Marketplace. All rights reserved.
          </p>
          <p className="text-xs text-slate-600">
            Pokémon and all related names are trademarks of Nintendo / Creatures Inc. / GAME FREAK inc.
          </p>
        </div>
      </div>
    </footer>
  )
}
