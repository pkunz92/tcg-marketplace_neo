'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { api, ApiError, type Listing, type AnalyzePhotoResponse, type ConditionCode } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import Button from '@/components/ui/button'
import Input from '@/components/ui/input'
import PhotoUpload from '@/components/photo/PhotoUpload'
import GradingBadge from '@/components/photo/GradingBadge'

const CONDITIONS: { value: ConditionCode; label: string }[] = [
  { value: 'MT', label: 'Mint' },
  { value: 'NM', label: 'Near Mint' },
  { value: 'LP', label: 'Lightly Played' },
  { value: 'MP', label: 'Moderately Played' },
  { value: 'HP', label: 'Heavily Played' },
  { value: 'DMG', label: 'Damaged' },
]

const GRADING_OPTIONS = [
  { value: 'RAW', label: 'Raw (Ungraded)' },
  { value: 'PSA', label: 'PSA Graded' },
  { value: 'BGS', label: 'BGS Graded' },
  { value: 'CGC', label: 'CGC Graded' },
  { value: 'TAG', label: 'TAG Graded' },
  { value: 'ACE', label: 'ACE Graded' },
] as const

interface CardMasterOption {
  id: string
  card_name: string
  set_name: string
  card_rarity: string
}

interface ListingFormProps {
  mode: 'create' | 'edit'
  initialData?: Listing
}

export default function ListingForm({ mode, initialData }: ListingFormProps) {
  const router = useRouter()
  const { toast } = useToast()

  // Card search
  const [cardQuery, setCardQuery] = useState(initialData?.card_name ?? '')
  const [cardOptions, setCardOptions] = useState<CardMasterOption[]>([])
  const [selectedCard, setSelectedCard] = useState<CardMasterOption | null>(
    initialData
      ? {
          id: initialData.card_master,
          card_name: initialData.card_name,
          set_name: initialData.set_name ?? '',
          card_rarity: initialData.card_rarity ?? '',
        }
      : null,
  )
  const [searchLoading, setSearchLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  // Form fields
  const [condition, setCondition] = useState<ConditionCode>(initialData?.condition ?? 'NM')
  const [grading, setGrading] = useState(initialData?.is_graded ?? 'RAW')
  const [price, setPrice] = useState(initialData?.price_chf?.toString() ?? '')
  const [quantity, setQuantity] = useState(initialData?.quantity?.toString() ?? '1')

  // Photo
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [analysis, setAnalysis] = useState<AnalyzePhotoResponse | null>(null)
  // Track if suggestions were applied so user can see them
  const [suggestionsApplied, setSuggestionsApplied] = useState(false)

  // Determine requiresPhoto: high-value (>= 20 CHF) or from backend flag
  const requiresPhoto =
    initialData?.requires_photo ??
    parseFloat(price || '0') >= 20

  const hasPhoto = photoFile !== null || (mode === 'edit' && !!initialData?.seller_photo)
  const canPublish = !requiresPhoto || hasPhoto

  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  async function searchCards(q: string) {
    if (q.length < 2) {
      setCardOptions([])
      return
    }
    setSearchLoading(true)
    try {
      const data = await api.get<{
        results?: { api_id: string; card_name: string; card_rarity?: string | null; set?: { set_name: string } | null }[]
      }>(`/cards/list/?search=${encodeURIComponent(q)}`)
      const raw = data.results ?? []
      const results: CardMasterOption[] = raw.slice(0, 8).map((c) => ({
        id: c.api_id,
        card_name: c.card_name,
        set_name: c.set?.set_name ?? '',
        card_rarity: c.card_rarity ?? '',
      }))
      setCardOptions(results)
      setShowDropdown(true)
    } catch {
      // ignore search errors
    } finally {
      setSearchLoading(false)
    }
  }

  function applyAnalysisSuggestions(result: AnalyzePhotoResponse) {
    setAnalysis(result)
    const top = result.card_suggestions[0]
    if (top && top.confidence > 0.3) {
      // Pre-fill card name if no card selected yet
      if (!selectedCard) {
        setCardQuery(top.name)
        searchCards(top.name)
      }
    }
    // Pre-fill condition
    setCondition(result.grading.suggested_condition)
    setSuggestionsApplied(true)
  }

  function clearPhoto() {
    setPhotoFile(null)
    setAnalysis(null)
    setSuggestionsApplied(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    if (!selectedCard) {
      toast('Please select a card', 'error')
      return
    }
    if (requiresPhoto && !hasPhoto) {
      toast('A photo is required for this card', 'error')
      return
    }

    setFieldErrors({})
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('card_master', selectedCard.id)
      formData.append('condition', condition)
      formData.append('is_graded', grading)
      formData.append('price_chf', price)
      formData.append('quantity', quantity)
      if (photoFile) {
        formData.append('seller_photo', photoFile)
      }

      if (mode === 'create') {
        await api.postForm<Listing>('/listings/', formData)
        toast('Listing created!', 'success')
      } else {
        await api.patchForm<Listing>(`/listings/${initialData!.id}/`, formData)
        toast('Listing updated!', 'success')
      }
      router.push('/dashboard/seller')
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        toast(err.detail, 'error')
        const fe: Record<string, string> = {}
        for (const [k, msgs] of Object.entries(err.fieldErrors)) {
          fe[k] = msgs[0]
        }
        setFieldErrors(fe)
      } else {
        toast(err instanceof Error ? err.message : 'Failed to save listing', 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/seller" className="text-slate-500 hover:text-slate-200 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold text-slate-100">
          {mode === 'create' ? 'New Listing' : 'Edit Listing'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Card selector */}
        <div className="relative">
          <Input
            label="Card"
            value={cardQuery}
            onChange={(e) => {
              setCardQuery(e.target.value)
              setSelectedCard(null)
              searchCards(e.target.value)
            }}
            onFocus={() => cardOptions.length > 0 && setShowDropdown(true)}
            placeholder="Search card name…"
            data-testid="card-search"
          />
          {suggestionsApplied && (
            <p className="text-xs text-accent-400 mt-1 flex items-center gap-1">
              <CheckCircle2 size={11} />
              Auto-detected — please verify
            </p>
          )}
          {showDropdown && cardOptions.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-elevated border border-border rounded-xl shadow-xl overflow-hidden">
              {cardOptions.map((c, idx) => (
                <button
                  key={c.id}
                  type="button"
                  data-testid={`card-suggestion-${idx}`}
                  onClick={() => {
                    setSelectedCard(c)
                    setCardQuery(c.card_name)
                    setShowDropdown(false)
                    setCardOptions([])
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-border transition-colors"
                >
                  <p className="text-sm text-slate-200">{c.card_name}</p>
                  <p className="text-xs text-slate-500">{c.set_name} · {c.card_rarity}</p>
                </button>
              ))}
            </div>
          )}
          {searchLoading && (
            <p className="text-xs text-slate-500 mt-1">Searching…</p>
          )}
        </div>

        {/* Condition + Grading */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1.5">Condition</label>
            <div className="relative">
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as ConditionCode)}
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-accent-500 appearance-none"
              >
                {CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label} ({c.value})
                  </option>
                ))}
              </select>
            </div>
            {suggestionsApplied && analysis && (
              <p className="text-xs text-accent-400 mt-1 flex items-center gap-1">
                <CheckCircle2 size={11} />
                Auto-detected — please verify
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1.5">Grading</label>
            <select
              value={grading}
              onChange={(e) => setGrading(e.target.value as typeof GRADING_OPTIONS[number]['value'])}
              className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-accent-500 appearance-none"
            >
              {GRADING_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Grading confidence badge — shown after analysis */}
        {analysis && (
          <GradingBadge
            condition={analysis.grading.suggested_condition}
            confidence={analysis.grading.confidence}
          />
        )}

        {/* Price + Quantity */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Price (CHF)"
            type="number"
            min="0.01"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            error={fieldErrors.price_chf}
            data-testid="listing-price"
          />
          <Input
            label="Quantity"
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="1"
            error={fieldErrors.quantity}
            data-testid="listing-quantity"
          />
        </div>

        {/* Photo upload */}
        <PhotoUpload
          required={requiresPhoto}
          onPhotoSelected={setPhotoFile}
          onAnalysisComplete={applyAnalysisSuggestions}
          onClear={clearPhoto}
        />

        {/* Publish block notice */}
        {requiresPhoto && !hasPhoto && (
          <div className="flex items-center gap-2 text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-3 text-sm">
            <span className="shrink-0">⚠</span>
            <span>A photo is required before you can publish this listing.</span>
          </div>
        )}

        <Button
          type="submit"
          loading={submitting}
          disabled={!canPublish || submitting}
          className="w-full"
          data-testid="listing-submit"
        >
          {mode === 'create' ? 'Publish Listing' : 'Save Changes'}
        </Button>
      </form>
    </div>
  )
}
