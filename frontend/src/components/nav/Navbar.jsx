import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Zap, Search, Menu, X, ShoppingBag, LayoutDashboard, LogOut, User } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { cn } from '../../lib/utils'
import toast from 'react-hot-toast'

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'text-sm font-medium transition-colors px-3 py-2 rounded-lg',
          isActive
            ? 'text-accent-400 bg-accent-500/10'
            : 'text-slate-400 hover:text-slate-100 hover:bg-elevated',
        )
      }
    >
      {children}
    </NavLink>
  )
}

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)

  async function handleLogout() {
    try {
      await logout()
      navigate('/login')
      toast.success('Logged out')
    } catch {
      toast.error('Logout failed')
    }
  }

  return (
    <header className="sticky top-0 z-40 bg-base/80 backdrop-blur-md border-b border-border">
      <div className="w-full px-4 sm:px-6 xl:px-12">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <Zap size={22} className="text-accent-400" />
            <span className="font-display text-lg font-bold text-accent-400 tracking-wide">
              PokeMarket
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            <NavItem to="/cards">Cards</NavItem>
            <NavItem to="/market">Marketplace</NavItem>
          </nav>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/cards"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-elevated transition-colors"
            >
              <Search size={18} />
            </Link>

            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setUserOpen((v) => !v)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-elevated transition-colors text-sm text-slate-300"
                >
                  <User size={16} />
                  <span className="max-w-[100px] truncate">{user?.username}</span>
                </button>
                {userOpen && (
                  <div
                    className="absolute right-0 top-full mt-2 w-48 bg-elevated border border-border rounded-xl shadow-xl overflow-hidden"
                    onMouseLeave={() => setUserOpen(false)}
                  >
                    <Link
                      to="/dashboard"
                      className="flex items-center gap-2 px-4 py-3 text-sm text-slate-300 hover:bg-surface hover:text-slate-100 transition-colors"
                      onClick={() => setUserOpen(false)}
                    >
                      <LayoutDashboard size={15} /> Dashboard
                    </Link>
                    <Link
                      to="/dashboard/listings"
                      className="flex items-center gap-2 px-4 py-3 text-sm text-slate-300 hover:bg-surface hover:text-slate-100 transition-colors"
                      onClick={() => setUserOpen(false)}
                    >
                      <ShoppingBag size={15} /> My Listings
                    </Link>
                    <div className="border-t border-border" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-surface transition-colors"
                    >
                      <LogOut size={15} /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="text-sm text-slate-300 hover:text-slate-100 px-3 py-1.5 rounded-lg hover:bg-elevated transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="text-sm font-medium bg-accent-500 hover:bg-accent-400 text-base px-4 py-1.5 rounded-lg transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 rounded-lg text-slate-400 hover:bg-elevated"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-border py-3 flex flex-col gap-1">
            <NavItem to="/cards">Cards</NavItem>
            <NavItem to="/market">Marketplace</NavItem>
            {isAuthenticated ? (
              <>
                <NavItem to="/dashboard">Dashboard</NavItem>
                <button
                  onClick={handleLogout}
                  className="text-sm text-red-400 px-3 py-2 text-left hover:bg-elevated rounded-lg"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <NavItem to="/login">Sign In</NavItem>
                <NavItem to="/register">Sign Up</NavItem>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
