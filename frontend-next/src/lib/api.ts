/**
 * Typed API client for TCG Marketplace.
 * Uses the /api proxy configured in next.config.ts (→ Django or future Fastify backend).
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
    public fieldErrors: Record<string, string[]> = {},
  ) {
    super(detail)
    this.name = 'ApiError'
  }
}

function parseApiError(status: number, body: Record<string, unknown>): ApiError {
  // DRF field errors: { "field": ["msg", ...], non_field_errors: ["msg"], detail: "msg" }
  const fieldErrors: Record<string, string[]> = {}
  let detail = `HTTP ${status}`
  for (const [key, val] of Object.entries(body)) {
    if (key === 'detail' || key === 'error') {
      detail = String(val)
    } else if (key === 'non_field_errors' && Array.isArray(val)) {
      detail = val.join(' ')
    } else if (Array.isArray(val)) {
      fieldErrors[key] = val.map(String)
    }
  }
  if (detail === `HTTP ${status}`) {
    detail = (body.detail ?? body.error) as string ?? JSON.stringify(body)
  }
  return new ApiError(status, detail, fieldErrors)
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })

  if (!res.ok) {
    try {
      const body = await res.json()
      throw parseApiError(res.status, body)
    } catch (e) {
      if (e instanceof ApiError) throw e
    }
    throw new ApiError(res.status, `HTTP ${res.status}`)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

async function requestForm<T>(path: string, formData: FormData, method = 'POST'): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    body: formData,
    // No Content-Type header — browser sets multipart boundary automatically
  })

  if (!res.ok) {
    try {
      const body = await res.json()
      throw parseApiError(res.status, body)
    } catch (e) {
      if (e instanceof ApiError) throw e
    }
    throw new ApiError(res.status, `HTTP ${res.status}`)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),

  postForm: <T>(path: string, formData: FormData) => requestForm<T>(path, formData),

  patchForm: <T>(path: string, formData: FormData) => requestForm<T>(path, formData, 'PATCH'),

  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),

  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

/* ---- Domain types ---- */

export interface CardSet {
  id: string
  set_name: string
  set_code: string
  ptcgo_code?: string
  series?: string
  release_date?: string
  symbol_url?: string
  logo_url?: string
}

export interface CardMaster {
  api_id: string
  language: string
  tcg_type: string
  card_name: string
  card_number: string
  secondary_id?: string
  card_rarity?: string
  image_url: string
  supertype?: string
  hp?: string
  types?: string[]
  artist?: string
  set: CardSet | null
}

export interface CardPriceStat {
  min_price: number | null
  max_price: number | null
  avg_price: number | null
  total_listings: number
}

export interface CardWithStats {
  card: CardMaster
  listings: Listing[]
  statistics: CardPriceStat
  market_prices: unknown[]
  translations: unknown[]
}

export interface User {
  id: number
  username: string
  email: string
}

export type ConditionCode = 'MT' | 'NM' | 'LP' | 'MP' | 'HP' | 'DMG'
export type GradingCode = 'RAW' | 'PSA' | 'BGS' | 'CGC' | 'TAG' | 'ACE'
export type GradingStatus = 'none' | 'queued' | 'processing' | 'complete' | 'failed'

export interface AutoGrade {
  grade: string
  confidence: number
  detectedCard?: string
}

export interface Listing {
  id: string
  card_master: string
  card_name: string
  card_number?: string
  card_rarity?: string
  card_image_url: string
  set_name: string
  set_code?: string
  condition: ConditionCode
  is_graded: GradingCode
  price_chf: number
  quantity: number
  seller: number
  seller_username: string
  seller_photo: string | null
  seller_photo_url: string | null
  is_available: boolean
  requires_photo: boolean
  grading_status: GradingStatus
  auto_grade: AutoGrade | null
  created_at: string
  seller_reputation_score: number | null
  seller_reputation_count: number
}

export interface CardSuggestion {
  name: string
  set: string
  confidence: number
}

export interface AnalyzePhotoResponse {
  card_suggestions: CardSuggestion[]
  grading: {
    suggested_condition: ConditionCode
    suggested_psa_grade: number | null
    confidence: number
    confidence_breakdown: Record<ConditionCode, number>
    issues_detected: string[]
    method: string
  }
  photo_quality: {
    ok: boolean
    warnings: string[]
  }
}

export interface Order {
  id: string
  listing: string
  card_name: string
  card_image_url: string
  set_name: string
  condition: string
  quantity: number
  price_chf: number
  total_chf: number
  total_price?: number
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'SHIPPED' | 'DELIVERED'
  review?: Review | null
  tracking_number: string | null
  buyer_username: string
  seller_username: string
  shipping_name: string
  shipping_address_line1: string
  shipping_city: string
  shipping_postal_code: string
  shipping_country: string
  created_at: string
}

export interface WatchlistItem {
  id: string
  listing: Listing
  created_at: string
}

export interface UserProfile {
  id: number
  username: string
  email: string
  shipping_name: string
  shipping_address_line1: string
  shipping_city: string
  shipping_postal_code: string
  shipping_country: string
}

export interface Payout {
  id: string
  amount: number
  status: string
  created_at: string
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface Review {
  id: number
  order: number
  reviewer: number
  reviewer_username: string
  seller: number
  stars: number
  comment: string
  card_name: string
  created_at: string
}

export interface Reputation {
  seller_id: number
  seller_username: string
  score: number | null
  total_reviews: number
  recent_reviews: number
}

export interface SellerProfile {
  seller_id: number
  seller_username: string
  reputation: Omit<Reputation, 'seller_id' | 'seller_username'>
  active_listings: Listing[]
}

export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'COUNTERED'

export interface Offer {
  id: number
  listing: number
  buyer: number
  buyer_username: string
  offer_price_chf: string
  counter_price_chf: string | null
  status: OfferStatus
  expires_at: string
  created_at: string
}

export type DisputeReason = 'not_received' | 'not_as_described' | 'unauthorized' | 'other'
export type DisputeStatus = 'open' | 'resolved' | 'closed'

export interface Dispute {
  id: number
  order: number
  order_id: number
  opened_by: number
  opened_by_username: string
  reason: DisputeReason
  description: string
  status: DisputeStatus
  resolution: string
  created_at: string
  resolved_at: string | null
}
