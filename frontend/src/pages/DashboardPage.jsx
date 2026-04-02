import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useMyListings } from '../hooks/useListings'
import { useMyOrders } from '../hooks/useOrders'
import PageContainer from '../components/layout/PageContainer'
import { ShoppingBag, Package, User, Plus } from 'lucide-react'
import Button from '../components/ui/Button'
import StatCard from '../components/ui/StatCard'
import { useState } from 'react'
import CreateListingModal from '../components/marketplace/CreateListingModal'

export default function DashboardPage() {
  const { user } = useAuth()
  const { data: listingsData } = useMyListings()
  const { data: ordersData } = useMyOrders()
  const [showCreate, setShowCreate] = useState(false)

  const listings = listingsData?.results || listingsData || []
  const orders = ordersData?.results || ordersData || []

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-0.5">Welcome back, {user?.username}</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Listing
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Active Listings" value={listings.filter(l => l.is_available).length} icon={ShoppingBag} />
        <StatCard label="Total Orders" value={orders.length} icon={Package} color="text-blue-400" />
        <StatCard label="Account" value={user?.email?.split('@')[0] || '—'} icon={User} color="text-emerald-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-200">My Listings</h2>
            <Link to="/dashboard/listings" className="text-xs text-accent-500 hover:text-accent-400">View all</Link>
          </div>
          {listings.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No listings yet.</p>
          ) : (
            <div className="space-y-2">
              {listings.slice(0, 5).map((l) => (
                <div key={l.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
                  <span className="text-slate-300 truncate">{l.card_name}</span>
                  <span className="font-mono text-accent-400 shrink-0 ml-2">CHF {Number(l.price_chf).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-200">Recent Orders</h2>
            <Link to="/dashboard/orders" className="text-xs text-accent-500 hover:text-accent-400">View all</Link>
          </div>
          {orders.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No orders yet.</p>
          ) : (
            <div className="space-y-2">
              {orders.slice(0, 5).map((o) => (
                <div key={o.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
                  <span className="text-slate-300 truncate">Order #{o.id}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    o.status === 'COMPLETED' ? 'bg-green-950 text-green-400' :
                    o.status === 'CANCELLED' ? 'bg-red-950 text-red-400' :
                    'bg-yellow-950 text-yellow-400'
                  }`}>{o.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 bg-surface border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-200">Account</h2>
          <Link to="/dashboard/profile" className="text-xs text-accent-500 hover:text-accent-400">Edit profile</Link>
        </div>
        <div className="text-sm text-slate-400 space-y-1">
          <p>Username: <span className="text-slate-200">{user?.username}</span></p>
          <p>Email: <span className="text-slate-200">{user?.email}</span></p>
        </div>
      </div>

      <CreateListingModal open={showCreate} onClose={() => setShowCreate(false)} />
    </PageContainer>
  )
}
