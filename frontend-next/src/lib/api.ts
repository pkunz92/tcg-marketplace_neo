/**
 * Typed API client for TCG Marketplace.
 * Uses the /api proxy configured in next.config.ts (→ Django or future Fastify backend).
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail)
    this.name = 'ApiError'
  }
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
    let detail = `HTTP ${res.status}`
    try {
      const body = await res.json()
      detail = body.detail ?? body.error ?? JSON.stringify(body)
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),

  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),

  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

/* ---- Domain types ---- */

export interface User {
  id: number
  username: string
  email: string
}

export interface Listing {
  id: string
  card_name: string
  card_image_url: string
  set_name: string
  condition: string
  price_chf: number
  quantity: number
  seller_username: string
  is_available: boolean
  created_at: string
}

export interface Order {
  id: string
  listing: string
  card_name: string
  card_image_url: string
  set_name: string
  condition: string
  quantity: number
  total_price: number
  total_chf: number
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'SHIPPED'
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
