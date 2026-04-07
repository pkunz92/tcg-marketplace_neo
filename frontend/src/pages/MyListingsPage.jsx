import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMyListings, useDeleteListing, useUpdateListing } from '../hooks/useListings'
import PageContainer from '../components/layout/PageContainer'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import { Plus, Trash2, ShoppingBag, Pencil, CheckCircle, Layers } from 'lucide-react'
import EmptyState from '../components/ui/EmptyState'
import CreateListingModal from '../components/marketplace/CreateListingModal'
import ConditionBadge from '../components/cards/ConditionBadge'
import { formatCHF } from '../lib/utils'
import toast from 'react-hot-toast'
import Spinner from '../components/ui/Spinner'

function EditPriceModal({ listing, onClose }) {
  const [price, setPrice] = useState(String(listing.price_chf))
  const updateListing = useUpdateListing()

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      await updateListing.mutateAsync({ id: listing.id, price_chf: parseFloat(price) })
      toast.success('Price updated')
      onClose()
    } catch {
      toast.error('Failed to update price')
    }
  }

  return (
    <Modal open title="Edit Price" onClose={onClose} maxWidth="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-400">
          Update price for <span className="text-slate-200 font-medium">{listing.card_name}</span>
        </p>
        <Input
          label="New Price (CHF)"
          type="number"
          step="0.01"
          min="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={updateListing.isPending}>Save</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function MyListingsPage() {
  const { data, isLoading } = useMyListings()
  const deleteListing = useDeleteListing()
  const updateListing = useUpdateListing()
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
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

  async function handleMarkSold(listing) {
    if (!confirm(`Mark "${listing.card_name}" as sold out?`)) return
    try {
      await updateListing.mutateAsync({ id: listing.id, quantity: 0 })
      toast.success('Marked as sold out')
    } catch {
      toast.error('Failed to update listing')
    }
  }

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-100">My Listings</h1>
        <div className="flex gap-2">
          <Link to="/dashboard/bulk-listing">
            <Button variant="secondary"><Layers size={16} /> Bulk Upload</Button>
          </Link>
          <Button onClick={() => setShowCreate(true)} data-testid="new-listing-btn"><Plus size={16} /> New Listing</Button>
        </div>
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
                <tr key={l.id} data-testid="listing-row" className="border-b border-border/50 last:border-0 hover:bg-elevated transition-colors">
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
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditTarget(l)}
                        title="Edit price"
                        className="p-1.5 rounded text-slate-500 hover:text-accent-400 hover:bg-accent-500/10 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      {l.is_available && (
                        <button
                          onClick={() => handleMarkSold(l)}
                          title="Mark sold out"
                          className="p-1.5 rounded text-slate-500 hover:text-emerald-400 hover:bg-emerald-950/30 transition-colors"
                        >
                          <CheckCircle size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(l.id)}
                        title="Delete listing"
                        className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateListingModal open={showCreate} onClose={() => setShowCreate(false)} />
      {editTarget && <EditPriceModal listing={editTarget} onClose={() => setEditTarget(null)} />}
    </PageContainer>
  )
}
