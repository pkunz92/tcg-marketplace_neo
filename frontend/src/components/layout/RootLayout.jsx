import { Outlet } from 'react-router-dom'
import Navbar from '../nav/Navbar'

export default function RootLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-border py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} PokeMarket — Pokemon TCG Marketplace
      </footer>
    </div>
  )
}
