'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import useSWR from 'swr'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle,
  CreditCard,
  MapPin,
} from 'lucide-react'
import { api, type Listing, type UserProfile } from '@/lib/api'
import { formatCHF } from '@/lib/utils'
import Button from '@/components/ui/button'
import Input from '@/components/ui/input'
import Spinner from '@/components/ui/spinner'
import OrderSummary from '@/components/checkout/order-summary'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/lib/auth-context'

type Step = 'shipping' | 'payment' | 'done'

interface ShippingFields {
  shipping_name: string
  shipping_address_line1: string
  shipping_city: string
  shipping_postal_code: string
  shipping_country: string
}

const fetcher = (url: string) => api.get<Listing>(url)
const profileFetcher = () => api.get<UserProfile>('/profile/me/')

export default function CheckoutPage() {
  const { listingId } = useParams<{ listingId: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuth()

  const { data: listing, isLoading: listingLoading } = useSWR(
    listingId ? `/listings/${listingId}/` : null,
    fetcher,
  )
  const { data: profile } = useSWR(user ? '/profile/me/' : null, profileFetcher)

  const [qty, setQty] = useState(1)
  const [step, setStep] = useState<Step>('shipping')
  const [submitting, setSubmitting] = useState(false)
  const [shipping, setShipping] = useState<ShippingFields>({
    shipping_name: '',
    shipping_address_line1: '',
    shipping_city: '',
    shipping_postal_code: '',
    shipping_country: '',
  })

  // Pre-fill shipping from profile
  useEffect(() => {
    if (profile) {
      setShipping({
        shipping_name: profile.shipping_name ?? '',
        shipping_address_line1: profile.shipping_address_line1 ?? '',
        shipping_city: profile.shipping_city ?? '',
        shipping_postal_code: profile.shipping_postal_code ?? '',
        shipping_country: profile.shipping_country ?? '',
      })
    }
  }, [profile])

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?next=/checkout/' + listingId)
    }
  }, [authLoading, user, router, listingId])

  if (authLoading || listingLoading) {
    return (
      <div className="flex justify-center py-32">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!listing) {
    return (
      <p className="text-slate-400 text-center py-32">Listing not found.</p>
    )
  }

  async function handleShippingSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.patch('/profile/me/', shipping)
    } catch {
      // Non-fatal — proceed even if profile update fails
    } finally {
      setSubmitting(false)
    }
    setStep('payment')
  }

  async function handlePlaceOrder() {
    setSubmitting(true)
    try {
      const order = await api.post<{ id: string }>('/orders/', {
        listing: listingId,
        quantity: qty,
        ...shipping,
      })
      setStep('done')
      setTimeout(() => {
        router.push(`/orders/${order.id}`)
      }, 2500)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to place order'
      toast(msg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'done') {
    return (
      <div
        data-testid="order-success"
        className="max-w-md mx-auto text-center py-24 flex flex-col items-center gap-4"
      >
        <CheckCircle size={56} className="text-green-400" />
        <h2 className="text-2xl font-bold text-slate-100">Order Placed!</h2>
        <p className="text-slate-400">Redirecting to your order…</p>
      </div>
    )
  }

  return (
    <div>
      <Link
        href={`/market/${listingId}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors mb-6"
      >
        <ArrowLeft size={15} />
        Back to listing
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {/* Sidebar — order summary */}
        <div className="lg:col-span-1 order-2 lg:order-1">
          <OrderSummary listing={listing} qty={qty} onQtyChange={setQty} />
        </div>

        {/* Main form area */}
        <div className="lg:col-span-2 order-1 lg:order-2">
          {/* Step tabs */}
          <div className="flex gap-1 mb-6">
            {(['shipping', 'payment'] as const).map((s, i) => (
              <div
                key={s}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  step === s
                    ? 'bg-accent-500 text-white'
                    : 'text-slate-500 bg-elevated'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    step === s ? 'bg-white/20' : 'bg-border'
                  }`}
                >
                  {i + 1}
                </span>
                {s === 'shipping' ? 'Shipping' : 'Payment'}
              </div>
            ))}
          </div>

          {/* Shipping step */}
          {step === 'shipping' && (
            <form onSubmit={handleShippingSubmit} className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin size={16} className="text-accent-400" />
                <h2 className="text-lg font-semibold text-slate-100">Shipping Address</h2>
              </div>

              <Input
                label="Full Name"
                placeholder="Jane Doe"
                value={shipping.shipping_name}
                onChange={(e) => setShipping({ ...shipping, shipping_name: e.target.value })}
                required
                data-testid="shipping-name"
              />
              <Input
                label="Address"
                placeholder="123 Main St"
                value={shipping.shipping_address_line1}
                onChange={(e) =>
                  setShipping({ ...shipping, shipping_address_line1: e.target.value })
                }
                required
                data-testid="shipping-address"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="City"
                  placeholder="Zurich"
                  value={shipping.shipping_city}
                  onChange={(e) => setShipping({ ...shipping, shipping_city: e.target.value })}
                  required
                  data-testid="shipping-city"
                />
                <Input
                  label="Postal Code"
                  placeholder="8001"
                  value={shipping.shipping_postal_code}
                  onChange={(e) =>
                    setShipping({ ...shipping, shipping_postal_code: e.target.value })
                  }
                  required
                  data-testid="shipping-postal-code"
                />
              </div>
              <Input
                label="Country"
                placeholder="Switzerland"
                value={shipping.shipping_country}
                onChange={(e) =>
                  setShipping({ ...shipping, shipping_country: e.target.value })
                }
                required
                data-testid="shipping-country"
              />

              <div className="flex justify-end pt-2">
                <Button type="submit" size="lg" loading={submitting} data-testid="continue-to-payment">
                  Continue to Payment
                </Button>
              </div>
            </form>
          )}

          {/* Payment step */}
          {step === 'payment' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard size={16} className="text-accent-400" />
                <h2 className="text-lg font-semibold text-slate-100">Payment</h2>
              </div>

              {/* Stripe Elements mount point */}
              <div className="bg-surface border border-border rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard size={18} className="text-slate-400" />
                  <p className="text-sm font-medium text-slate-300">Card details</p>
                  <span className="ml-auto text-xs bg-elevated px-2 py-0.5 rounded text-slate-500 border border-border">
                    Stripe
                  </span>
                </div>
                <div
                  id="stripe-payment-element"
                  className="min-h-[120px] border border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 text-slate-600 text-sm"
                >
                  <CreditCard size={28} className="text-slate-700" />
                  <span>Stripe Payment Element</span>
                  <span className="text-xs text-slate-700">
                    {process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
                      ? 'Initializing…'
                      : 'Awaiting NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'}
                  </span>
                </div>
              </div>

              {/* Ship-to summary */}
              <div className="bg-elevated border border-border rounded-xl px-4 py-3 text-xs text-slate-500">
                <span className="text-slate-400 font-medium">Ship to:</span>{' '}
                {shipping.shipping_name}, {shipping.shipping_address_line1},{' '}
                {shipping.shipping_city} {shipping.shipping_postal_code},{' '}
                {shipping.shipping_country}
                {' · '}
                <button
                  type="button"
                  onClick={() => setStep('shipping')}
                  className="text-accent-400 hover:underline"
                >
                  Edit
                </button>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <Button variant="secondary" onClick={() => setStep('shipping')}>
                  Back
                </Button>
                <Button
                  size="lg"
                  onClick={handlePlaceOrder}
                  loading={submitting}
                  data-testid="place-order-btn"
                >
                  Place Order · {formatCHF(listing.price_chf * qty)}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
