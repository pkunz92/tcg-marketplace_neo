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
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { api, type Listing, type UserProfile } from '@/lib/api'
import { formatCHF } from '@/lib/utils'
import Button from '@/components/ui/button'
import Input from '@/components/ui/input'
import Spinner from '@/components/ui/spinner'
import OrderSummary from '@/components/checkout/order-summary'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/lib/auth-context'

// Initialise Stripe once outside the component — returns null if key is missing
const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null

type Step = 'shipping' | 'payment' | 'done'

interface ShippingFields {
  shipping_name: string
  shipping_address_line1: string
  shipping_city: string
  shipping_postal_code: string
  shipping_country: string
}

const fetcher = (url: string) => api.get<Listing>(url)
const profileFetcher = () => api.get<UserProfile>('/user/profile/')

// ---------------------------------------------------------------------------
// Inner component — must live inside <Elements> to call useStripe/useElements
// ---------------------------------------------------------------------------
interface StripePaymentFormProps {
  listing: Listing
  qty: number
  shipping: ShippingFields
  orderId: string
  onSuccess: () => void
  onBack: () => void
}

function StripePaymentForm({
  listing,
  qty,
  shipping,
  orderId,
  onSuccess,
  onBack,
}: StripePaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handlePlaceOrder() {
    if (!stripe || !elements) return
    setError('')
    setSubmitting(true)
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/orders/${orderId}`,
      },
      // Avoid redirect for card payments — handle result inline
      redirect: 'if_required',
    })
    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed. Please try again.')
      setSubmitting(false)
    } else {
      onSuccess()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <CreditCard size={16} className="text-accent-400" />
        <h2 className="text-lg font-semibold text-slate-100">Payment</h2>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard size={18} className="text-slate-400" />
          <p className="text-sm font-medium text-slate-300">Card details</p>
          <span className="ml-auto text-xs bg-elevated px-2 py-0.5 rounded text-slate-500 border border-border">
            Stripe
          </span>
        </div>
        <PaymentElement
          options={{
            layout: 'tabs',
          }}
        />
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Ship-to summary */}
      <div className="bg-elevated border border-border rounded-xl px-4 py-3 text-xs text-slate-500">
        <span className="text-slate-400 font-medium">Ship to:</span>{' '}
        {shipping.shipping_name}, {shipping.shipping_address_line1},{' '}
        {shipping.shipping_city} {shipping.shipping_postal_code},{' '}
        {shipping.shipping_country}
        {' · '}
        <button
          type="button"
          onClick={onBack}
          className="text-accent-400 hover:underline"
        >
          Edit
        </button>
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <Button variant="secondary" onClick={onBack} disabled={submitting}>
          Back
        </Button>
        <Button
          size="lg"
          onClick={handlePlaceOrder}
          loading={submitting}
          disabled={!stripe || !elements}
          data-testid="place-order-btn"
        >
          Place Order · {formatCHF(listing.price_chf * qty)}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main checkout page
// ---------------------------------------------------------------------------
export default function CheckoutPage() {
  const { listingId } = useParams<{ listingId: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuth()

  const { data: listing, isLoading: listingLoading } = useSWR(
    listingId ? `/listings/${listingId}/` : null,
    fetcher,
  )
  const { data: profile } = useSWR(user ? '/user/profile/' : null, profileFetcher)

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
  // Set once we create the order + payment intent
  const [orderId, setOrderId] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentSetupError, setPaymentSetupError] = useState('')

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
    setPaymentSetupError('')
    try {
      await api.patch('/user/profile/', shipping)
    } catch {
      // Non-fatal — proceed even if profile update fails
    }

    try {
      // Create a PENDING order, then a PaymentIntent for it
      const order = await api.post<{ id: string }>('/orders/', {
        listing: listingId,
        quantity: qty,
        ...shipping,
      })
      const { client_secret } = await api.post<{ client_secret: string }>(
        `/orders/${order.id}/create-payment-intent/`,
        {},
      )
      setOrderId(order.id)
      setClientSecret(client_secret)
      setStep('payment')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to initialise payment'
      setPaymentSetupError(msg)
      toast(msg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function handlePaymentSuccess() {
    setStep('done')
    setTimeout(() => {
      router.push(`/orders/${orderId}`)
    }, 2500)
  }

  function handleBackToShipping() {
    setStep('shipping')
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

              {paymentSetupError && (
                <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
                  {paymentSetupError}
                </p>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  size="lg"
                  loading={submitting}
                  data-testid="continue-to-payment"
                >
                  Continue to Payment
                </Button>
              </div>
            </form>
          )}

          {/* Payment step */}
          {step === 'payment' && (
            <>
              {!clientSecret || !stripePromise ? (
                <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
                  {!stripePublishableKey ? (
                    <p className="text-sm text-red-400">
                      Payment is not configured (missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).
                    </p>
                  ) : (
                    <Spinner size="lg" />
                  )}
                </div>
              ) : (
                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret,
                    appearance: {
                      theme: 'night',
                      variables: {
                        colorPrimary: '#7c3aed',
                        borderRadius: '8px',
                      },
                    },
                  }}
                >
                  <StripePaymentForm
                    listing={listing}
                    qty={qty}
                    shipping={shipping}
                    orderId={orderId!}
                    onSuccess={handlePaymentSuccess}
                    onBack={handleBackToShipping}
                  />
                </Elements>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
