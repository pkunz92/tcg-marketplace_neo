import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import PageContainer from '../components/layout/PageContainer'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import SearchInput from '../components/catalog/SearchInput'
import { useCardsList } from '../hooks/useCards'
import { useCreateListing, useAnalyzePhoto } from '../hooks/useListings'
import { useDebounce } from '../hooks/useDebounce'
import { Upload, X, ChevronLeft, ChevronRight, CheckCircle, Sparkles, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const CONDITIONS = ['MT', 'NM', 'LP', 'MP', 'HP', 'DMG']
const GRADING_COMPANIES = ['PSA', 'BGS', 'CGC', 'TAG', 'ACE']

// Single card review step
function CardReviewStep({ item, index, total, onUpdate, onRemove }) {
  const [search, setSearch] = useState(item.suggestedName || '')
  const debSearch = useDebounce(search, 300)
  const { data } = useCardsList({ search: debSearch, page: 1 }, { enabled: debSearch.length > 1 })
  const suggestions = data?.results || []
  const [showSuggestions, setShowSuggestions] = useState(false)

  function selectCard(card) {
    onUpdate({ selectedCard: card })
    setSearch(card.card_name)
    setShowSuggestions(false)
  }

  return (
    <div className="space-y-5">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span>Card {index + 1} of {total}</span>
        <div className="flex-1 bg-elevated rounded-full h-1.5">
          <div
            className="bg-accent-500 h-1.5 rounded-full transition-all"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Photo preview */}
        <div className="flex flex-col items-center gap-3">
          <img
            src={item.preview}
            alt="Card photo"
            className="max-h-64 rounded-xl object-contain border border-border bg-elevated"
          />
          {item.analyzing && (
            <div className="flex items-center gap-1.5 text-xs text-accent-400">
              <Sparkles size={12} className="animate-pulse" /> Analyzing…
            </div>
          )}
          {item.suggestion && !item.analyzing && (
            <div className="w-full bg-accent-500/10 border border-accent-500/30 rounded-lg px-3 py-2 text-xs">
              <div className="flex items-center gap-1.5 text-accent-300 mb-1">
                <Sparkles size={11} />
                <span className="font-medium">AI suggestion</span>
              </div>
              <p className="text-slate-300">{item.suggestion.card_name}</p>
              {item.suggestion.set_name && (
                <p className="text-slate-500">{item.suggestion.set_name}</p>
              )}
            </div>
          )}
        </div>

        {/* Form fields */}
        <div className="space-y-3">
          {/* Card search */}
          <div>
            <label className="text-sm font-medium text-slate-300 block mb-1">Card</label>
            {item.selectedCard ? (
              <div className="flex items-center gap-3 bg-elevated border border-accent-500/40 rounded-lg p-3">
                <img src={item.selectedCard.image_url} alt={item.selectedCard.card_name} className="w-10 rounded" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{item.selectedCard.card_name}</p>
                  <p className="text-xs text-slate-400">{item.selectedCard.set?.set_name}</p>
                </div>
                <button type="button" onClick={() => { onUpdate({ selectedCard: null }); setSearch('') }} className="text-xs text-slate-500 hover:text-slate-300 shrink-0">
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <SearchInput
                  value={search}
                  onChange={(v) => { setSearch(v); setShowSuggestions(true) }}
                  placeholder="Search for card…"
                />
                {showSuggestions && suggestions.length > 0 && search.length > 1 && (
                  <div className="absolute top-full left-0 right-0 z-50 bg-elevated border border-border rounded-xl shadow-xl mt-1 max-h-52 overflow-y-auto">
                    {suggestions.slice(0, 6).map((c) => (
                      <button
                        key={c.api_id}
                        type="button"
                        onClick={() => selectCard(c)}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface text-left transition-colors"
                      >
                        <img src={c.image_url} alt={c.card_name} className="w-8 rounded" />
                        <div>
                          <p className="text-sm text-slate-200">{c.card_name}</p>
                          <p className="text-xs text-slate-500">{c.set?.set_name}</p>
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
              value={item.condition}
              onChange={(e) => onUpdate({ condition: e.target.value })}
            >
              {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Input
              label="Price (CHF)"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={item.price_chf}
              onChange={(e) => onUpdate({ price_chf: e.target.value })}
            />
          </div>

          <Input
            label="Quantity"
            type="number"
            min="1"
            value={item.quantity}
            onChange={(e) => onUpdate({ quantity: e.target.value })}
          />

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={item.isGraded}
              onChange={(e) => onUpdate({ isGraded: e.target.checked })}
              className="accent-yellow-400"
            />
            <span className="text-sm text-slate-300">Professionally graded</span>
          </label>

          {item.isGraded && (
            <Select
              label="Grading Company"
              value={item.grading_company}
              onChange={(e) => onUpdate({ grading_company: e.target.value })}
            >
              {GRADING_COMPANIES.map((g) => <option key={g} value={g}>{g}</option>)}
            </Select>
          )}

          <button
            type="button"
            onClick={onRemove}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors mt-1"
          >
            <X size={12} /> Remove this card
          </button>
        </div>
      </div>
    </div>
  )
}

function makeItem(file) {
  return {
    file,
    preview: URL.createObjectURL(file),
    analyzing: false,
    suggestion: null,
    suggestedName: '',
    selectedCard: null,
    condition: 'NM',
    price_chf: '',
    quantity: '1',
    isGraded: false,
    grading_company: 'PSA',
    done: false,
  }
}

export default function BulkListingPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [step, setStep] = useState('upload') // 'upload' | 'review' | 'submit'
  const [reviewIndex, setReviewIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const dropRef = useRef(null)
  const fileInputRef = useRef(null)
  const analyzePhoto = useAnalyzePhoto()
  const createListing = useCreateListing()

  function updateItem(index, patch) {
    setItems((prev) => prev.map((it, i) => i === index ? { ...it, ...patch } : it))
  }

  function removeItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index))
    if (reviewIndex >= items.length - 1) setReviewIndex(Math.max(0, reviewIndex - 1))
  }

  async function addFiles(files) {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (!imageFiles.length) return

    const newItems = imageFiles.map(makeItem)
    setItems((prev) => [...prev, ...newItems])

    // Kick off analyze-photo for each new item
    const startIndex = items.length
    for (let i = 0; i < newItems.length; i++) {
      const idx = startIndex + i
      setItems((prev) => prev.map((it, j) => j === idx ? { ...it, analyzing: true } : it))
      try {
        const result = await analyzePhoto.mutateAsync(newItems[i].file)
        setItems((prev) => prev.map((it, j) =>
          j === idx ? {
            ...it,
            analyzing: false,
            suggestion: result,
            suggestedName: result.card_name || '',
            condition: result.condition || it.condition,
          } : it
        ))
      } catch {
        setItems((prev) => prev.map((it, j) => j === idx ? { ...it, analyzing: false } : it))
      }
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    addFiles(e.dataTransfer.files)
  }

  function handleFileInput(e) {
    addFiles(e.target.files)
    e.target.value = ''
  }

  function handleDragOver(e) {
    e.preventDefault()
  }

  async function handleSubmitAll() {
    const valid = items.filter((it) => it.selectedCard && it.price_chf)
    if (!valid.length) {
      toast.error('Select a card and set a price for at least one listing')
      return
    }
    const invalid = items.filter((it) => !it.selectedCard || !it.price_chf)
    if (invalid.length && !confirm(`${invalid.length} card(s) without a card or price will be skipped. Continue?`)) return

    setSubmitting(true)
    let successCount = 0
    let failCount = 0
    for (const it of valid) {
      try {
        const fd = new FormData()
        fd.append('card_master', it.selectedCard.api_id)
        fd.append('condition', it.condition)
        fd.append('price_chf', parseFloat(it.price_chf))
        fd.append('quantity', parseInt(it.quantity))
        fd.append('is_graded', it.isGraded)
        fd.append('grading_company', it.isGraded ? it.grading_company : 'RAW')
        fd.append('seller_photo', it.file)
        await createListing.mutateAsync(fd)
        successCount++
      } catch {
        failCount++
      }
    }
    setSubmitting(false)
    if (successCount > 0) toast.success(`${successCount} listing(s) created!`)
    if (failCount > 0) toast.error(`${failCount} listing(s) failed`)
    navigate('/dashboard/listings')
  }

  // ─── Upload step ───────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <PageContainer>
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/dashboard/listings')} className="text-slate-500 hover:text-slate-300 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-slate-100">Bulk Card Upload</h1>
        </div>

        <div
          ref={dropRef}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border hover:border-accent-500/50 rounded-2xl py-16 flex flex-col items-center justify-center gap-4 cursor-pointer transition-colors bg-surface/50 hover:bg-surface"
        >
          <Upload size={40} className="text-slate-500" />
          <div className="text-center">
            <p className="text-slate-300 font-medium">Drop card photos here</p>
            <p className="text-slate-500 text-sm mt-1">or click to browse — JPG, PNG, WEBP supported</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileInput}
            className="hidden"
          />
        </div>

        {items.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-slate-400">{items.length} photo(s) selected</p>
              <button onClick={() => setItems([])} className="text-xs text-slate-500 hover:text-red-400 transition-colors">
                Clear all
              </button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3 mb-6">
              {items.map((it, i) => (
                <div key={i} className="relative group">
                  <img src={it.preview} alt="" className="rounded-xl object-cover aspect-[63/88] w-full border border-border" />
                  {it.analyzing && (
                    <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                      <Spinner size="sm" />
                    </div>
                  )}
                  {it.suggestion && !it.analyzing && (
                    <div className="absolute top-1 right-1">
                      <Sparkles size={12} className="text-accent-400" />
                    </div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeItem(i) }}
                    className="absolute -top-1.5 -right-1.5 bg-red-600 rounded-full p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => { setReviewIndex(0); setStep('review') }}
                disabled={items.some((it) => it.analyzing)}
              >
                Review Cards <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </PageContainer>
    )
  }

  // ─── Review step ───────────────────────────────────────────────────
  if (step === 'review') {
    const current = items[reviewIndex]
    if (!current) {
      return (
        <PageContainer>
          <p className="text-slate-400">No cards to review.</p>
          <Button onClick={() => setStep('upload')} className="mt-4">Back</Button>
        </PageContainer>
      )
    }

    const readyCount = items.filter((it) => it.selectedCard && it.price_chf).length

    return (
      <PageContainer>
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setStep('upload')} className="text-slate-500 hover:text-slate-300 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-slate-100">Review Cards</h1>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-6 mb-6">
          <CardReviewStep
            item={current}
            index={reviewIndex}
            total={items.length}
            onUpdate={(patch) => updateItem(reviewIndex, patch)}
            onRemove={() => removeItem(reviewIndex)}
          />
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="secondary"
            onClick={() => setReviewIndex((i) => Math.max(0, i - 1))}
            disabled={reviewIndex === 0}
          >
            <ChevronLeft size={16} /> Previous
          </Button>

          <div className="flex items-center gap-2 text-sm text-slate-400">
            {readyCount > 0 && (
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle size={14} /> {readyCount} ready
              </span>
            )}
            {items.length - readyCount > 0 && (
              <span className="flex items-center gap-1 text-slate-500">
                <AlertCircle size={14} /> {items.length - readyCount} incomplete
              </span>
            )}
          </div>

          {reviewIndex < items.length - 1 ? (
            <Button onClick={() => setReviewIndex((i) => i + 1)}>
              Next <ChevronRight size={16} />
            </Button>
          ) : (
            <Button
              onClick={handleSubmitAll}
              loading={submitting}
              disabled={readyCount === 0}
            >
              Submit {readyCount} Listing{readyCount !== 1 ? 's' : ''}
            </Button>
          )}
        </div>
      </PageContainer>
    )
  }

  return null
}
