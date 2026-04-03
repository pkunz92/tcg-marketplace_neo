import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useMyListings } from '../hooks/useListings'
import { useMyOrders } from '../hooks/useOrders'
import { useMyOffers } from '../hooks/useOffers'
import PageContainer from '../components/layout/PageContainer'
import { ShoppingBag, Package, Tag, Wallet, Plus, Layers } from 'lucide-react'
import Button from '../components/ui/Button'
import StatCard from '../components/ui/StatCard'
import { useState } from 'react'
import CreateListingModal from '../components/marketplace/CreateListingModal'
import { formatCHF, formatDate } from '../lib/utils'

export default function DashboardPage() {
  const { user } = useAuth()
  const { data: listingsData } = useMyListings()
  const { data: ordersData } = useMyOrders()
  const { data: offersData } = useMyOffers()
  const [showCreate, setShowCreate] = useState(false)

  const listings = listingsData?.results || listingsData || []
  const orders = ordersData?.results || ordersData || []
  const offers = offersData?.results || offersData || []

  const activeListings = listings.filter((l) => l.is_available)
  const pendingOffers = offers.filter(
    (o) => o.seller_username === user?.username && o.status === 'PENDING'
  )
  const completedSales = orders.filter((o) => o.status === 'COMPLETED')
  const payoutTotal = completedSales.reduce((sum, o) => sum + parseFloat(o.total_chf || 0), 0)

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-0.5">Welcome back, {user?.username}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/dashboard/bulk-listing">
            <Button variant="secondary"><Layers size={16} /> Bulk Upload</Button>
          </Link>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} /> New Listing
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Active Listings" value={activeListings.length} icon={ShoppingBag} />
        <StatCard label="Pending Offers" value={pendingOffers.length} icon={Tag} color="text-yellow-400" />
        <StatCard label="Completed Sales" value={completedSales.length} icon={Package} color="text-blue-400" />
        <StatCard label="Payout Balance" value={formatCHF(payoutTotal)} icon={Wallet} color="text-emerald-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Active Listings */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-200">Active Listings</h2>
            <Link to="/dashboard/listings" className="text-xs text-accent-500 hover:text-accent-400">View all</Link>
          </div>
          {activeListings.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No active listings.</p>
          ) : (
            <div className="space-y-2">
              {activeListings.slice(0, 5).map((l) => (
                <div key={l.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <img src={l.card_image_url} alt={l.card_name} className="w-6 rounded shrink-0" />
                    <span className="text-slate-300 truncate">{l.card_name}</span>
                  </div>
                  <span className="font-mono text-accent-400 shrink-0 ml-2">{formatCHF(l.price_chf)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Offers */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-200">Pending Offers</h2>
            <Link to="/dashboard/offers" className="text-xs text-accent-500 hover:text-accent-400">View all</Link>
          </div>
          {pendingOffers.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No pending offers.</p>
          ) : (
            <div className="space-y-2">
              {pendingOffers.slice(0, 5).map((o) => (
                <div key={o.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
                  <div className="min-w-0">
                    <span className="text-slate-300 truncate block">{o.card_name || o.listing_card_name}</span>
                    <span className="text-xs text-slate-500">from {o.buyer_username}</span>
                  </div>
                  <span className="font-mono text-yellow-400 shrink-0 ml-2">{formatCHF(o.offer_price_chf)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Sales */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-200">Recent Sales</h2>
            <Link to="/dashboard/orders" className="text-xs text-accent-500 hover:text-accent-400">View all</Link>
          </div>
          {completedSales.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No completed sales yet.</p>
          ) : (
            <div className="space-y-2">
              {completedSales.slice(0, 5).map((o) => (
                <div key={o.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
                  <div className="min-w-0">
                    <span className="text-slate-300 truncate block">Order #{o.id?.slice(0, 8) || o.id}</span>
                    <span className="text-xs text-slate-500">{formatDate(o.created_at)}</span>
                  </div>
                  <span className="font-mono text-emerald-400 shrink-0 ml-2">{formatCHF(o.total_chf)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Account */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-200">Account</h2>
            <Link to="/dashboard/profile" className="text-xs text-accent-500 hover:text-accent-400">Edit profile</Link>
          </div>
          <div className="text-sm text-slate-400 space-y-1">
            <p>Username: <span className="text-slate-200">{user?.username}</span></p>
            <p>Email: <span className="text-slate-200">{user?.email}</span></p>
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-slate-500 mb-1">Lifetime payout</p>
            <p className="text-xl font-bold font-mono text-emerald-400">{formatCHF(payoutTotal)}</p>
          </div>
        </div>
      </div>

      <CreateListingModal open={showCreate} onClose={() => setShowCreate(false)} />
    </PageContainer>
  )
}
