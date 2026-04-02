import { useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import SearchInput from '../catalog/SearchInput'
import { useCardsList } from '../../hooks/useCards'
import { useCreateListing } from '../../hooks/useListings'
import { useDebounce } from '../../hooks/useDebounce'
import toast from 'react-hot-toast'

export default function CreateListingModal({ open, onClose }) {
  const [search, setSearch] = useState('')
  const [selectedCard, setSelectedCard] = useState(null)
  const [form, setForm] = useState({ condition: 'NM', price_chf: '', quantity: '1', grading_company: 'RAW' })
  const [isGraded, setIsGraded] = useState(false)
  const debSearch = useDebounce(search, 300)
  const { data } = useCardsList({ search: debSearch, page: 1 }, { enabled: debSearch.length > 1 })
  const createListing = useCreateListing()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selectedCard) return toast.error('Select a card first')
    try {
      await createListing.mutateAsync({
        card_master: selectedCard.api_id,
        condition: form.condition,
        price_chf: parseFloat(form.price_chf),
        quantity: parseInt(form.quantity),
        is_graded: isGraded,
        grading_company: isGraded ? form.grading_company : 'RAW',
      })
      toast.success('Listing created!')
      onClose()
      setSelectedCard(null)
      setSearch('')
      setForm({ condition: 'NM', price_chf: '', quantity: '1', grading_company: 'RAW' })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create listing')
    }
  }

  const suggestions = data?.results || []

  return (
    <Modal open={open} onClose={onClose} title="Create Listing" maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Card search */}
        <div>
          <label className="text-sm font-medium text-slate-300 block mb-1">Card</label>
          {selectedCard ? (
            <div className="flex items-center gap-3 bg-elevated border border-accent-500/40 rounded-lg p-3">
              <img src={selectedCard.image_url} alt={selectedCard.card_name} className="w-10 rounded" />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-200">{selectedCard.card_name}</p>
                <p className="text-xs text-slate-400">{selectedCard.set?.set_name}</p>
              </div>
              <button type="button" onClick={() => setSelectedCard(null)} className="text-xs text-slate-500 hover:text-slate-300">Change</button>
            </div>
          ) : (
            <div className="relative">
              <SearchInput value={search} onChange={setSearch} placeholder="Search for a card…" />
              {suggestions.length > 0 && search.length > 1 && (
                <div className="absolute top-full left-0 right-0 z-50 bg-elevated border border-border rounded-xl shadow-xl mt-1 max-h-60 overflow-y-auto">
                  {suggestions.slice(0, 8).map((c) => (
                    <button
                      key={c.api_id}
                      type="button"
                      onClick={() => { setSelectedCard(c); setSearch('') }}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface text-left transition-colors"
                    >
                      <img src={c.image_url} alt={c.card_name} className="w-8 rounded" />
                      <div>
                        <p className="text-sm text-slate-200">{c.card_name}</p>
                        <p className="text-xs text-slate-500">{c.set?.set_name} · {c.card_rarity}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Condition"
            value={form.condition}
            onChange={(e) => setForm({ ...form, condition: e.target.value })}
          >
            {['MT','NM','LP','MP','HP','DMG'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          <Input
            label="Price (CHF)"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            value={form.price_chf}
            onChange={(e) => setForm({ ...form, price_chf: e.target.value })}
            required
          />
        </div>

        <Input
          label="Quantity"
          type="number"
          min="1"
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
        />

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isGraded}
            onChange={(e) => setIsGraded(e.target.checked)}
            className="accent-yellow-400"
          />
          <span className="text-sm text-slate-300">Professionally graded</span>
        </label>

        {isGraded && (
          <Select
            label="Grading Company"
            value={form.grading_company}
            onChange={(e) => setForm({ ...form, grading_company: e.target.value })}
          >
            {['PSA','BGS','CGC','TAG','ACE'].map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </Select>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={createListing.isPending}>Create Listing</Button>
        </div>
      </form>
    </Modal>
  )
}
