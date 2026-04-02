import { useState } from 'react'
import { useMyListings, useDeleteListing } from '../hooks/useListings'
import PageContainer from '../components/layout/PageContainer'
import Button from '../components/ui/Button'
import { Plus, Trash2, ShoppingBag } from 'lucide-react'
import EmptyState from '../components/ui/EmptyState'
import CreateListingModal from '../components/marketplace/CreateListingModal'
import ConditionBadge from '../components/cards/ConditionBadge'
import { formatCHF } from '../lib/utils'
import toast from 'react-hot-toast'
import Spinner from '../components/ui/Spinner'

export default function MyListingsPage() {
  const { data, isLoading } = useMyListings()
  const deleteListing = useDeleteListing()
  const [showCreate, setShowCreate] = useState(false)
  const listings = data?.results || data || []

  async function handleDelete(id) {
    if (!confirm('Remove this listing?')) return
    try {
      await deleteListing.mutateAsync(id)
      toast.success('Listing removed')
    } catch {
      toast.error('Failed to remove listing')
    }
  }

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-100">My Listings</h1>
        <Button onClick={() => setShowCreate(true)}><Plus size={16} /> New Listing</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : listings.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="No listings yet" description="List your first card for sale." action={
          <Button onClick={() => setShowCreate(true)}><Plus size={16} /> Create Listing</Button>
        } />
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-slate-500 uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">Card</th>
                <th className="text-left px-4 py-3 font-medium">Condition</th>
                <th className="text-left px-4 py-3 font-medium">Price</th>
                <th className="text-left px-4 py-3 font-medium">Qty</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id} className="border-b border-border/50 last:border-0 hover:bg-elevated transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={l.card_image_url} alt={l.card_name} className="w-8 rounded" loading="lazy" />
                      <span className="text-slate-200 font-medium">{l.card_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><ConditionBadge condition={l.condition} /></td>
                  <td className="px-4 py-3 font-mono text-accent-400">{formatCHF(l.price_chf)}</td>
                  <td className="px-4 py-3 text-slate-300">{l.quantity}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${l.is_available ? 'bg-green-950 text-green-400' : 'bg-slate-800 text-slate-400'}`}>
                      {l.is_available ? 'Active' : 'Sold Out'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(l.id)}
                      className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateListingModal open={showCreate} onClose={() => setShowCreate(false)} />
    </PageContainer>
  )
}
