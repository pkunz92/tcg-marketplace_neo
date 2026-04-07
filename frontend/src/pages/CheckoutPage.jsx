import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CreditCard, MapPin, ArrowLeft, CheckCircle } from 'lucide-react'
import api from '../lib/api'
import PageContainer from '../components/layout/PageContainer'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Spinner from '../components/ui/Spinner'
import { useProfile, useUpdateProfile } from '../hooks/useProfile'
import { useCreateOrder } from '../hooks/useOrders'
import { formatCHF } from '../lib/utils'
import toast from 'react-hot-toast'

function useListing(id) {
  return useQuery({
    queryKey: ['listings', 'detail', id],
    queryFn: () => api.get(`/listings/${id}/`).then((r) => r.data),
    enabled: !!id,
  })
}

export default function CheckoutPage() {
  const { listingId } = useParams()
  const navigate = useNavigate()
  const { data: listing, isLoading: listingLoading } = useListing(listingId)
  const { data: profile, isLoading: profileLoading } = useProfile()
  const updateProfile = useUpdateProfile()
  const createOrder = useCreateOrder()

  const [qty, setQty] = useState(1)
  const [step, setStep] = useState('shipping') // 'shipping' | 'payment' | 'done'
  const [shipping, setShipping] = useState({
    shipping_name: '',
    shipping_address_line1: '',
    shipping_city: '',
    shipping_postal_code: '',
    shipping_country: '',
  })

  // Pre-fill from profile once loaded
  useState(() => {
    if (profile) {
      setShipping({
        shipping_name: profile.shipping_name || '',
        shipping_address_line1: profile.shipping_address_line1 || '',
        shipping_city: profile.shipping_city || '',
        shipping_postal_code: profile.shipping_postal_code || '',
        shipping_country: profile.shipping_country || '',
      })
    }
  })

  if (listingLoading || profileLoading) {
    return (
      <PageContainer>
        <div className="flex justify-center py-32"><Spinner size="lg" /></div>
      </PageContainer>
    )
  }

  if (!listing) {
    return (
      <PageContainer>
        <p className="text-slate-400 text-center py-32">Listing not found.</p>
      </PageContainer>
    )
  }

  const total = listing.price_chf * qty

  async function handleShippingContinue(e) {
    e.preventDefault()
    // Save shipping to profile for future orders
    try {
      await updateProfile.mutateAsync(shipping)
    } catch {
      // Non-fatal — continue even if profile update fails
    }
    setStep('payment')
  }

  async function handlePlaceOrder() {
    try {
      const order = await createOrder.mutateAsync({
        listing: listing.id,
        quantity: qty,
        ...shipping,
      })
      setStep('done')
      // In a real integration this is where Stripe would redirect
      setTimeout(() => navigate('/dashboard/orders'), 2000)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to place order')
    }
  }

  if (step === 'done') {
    return (
      <PageContainer>
        <div data-testid="order-success" className="max-w-md mx-auto text-center py-24 flex flex-col items-center gap-4">
          <CheckCircle size={56} className="text-green-400" />
          <h2 className="text-2xl font-bold text-slate-100">Order Placed!</h2>
          <p className="text-slate-400">Redirecting you to your orders…</p>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <Link
        to={`/market/${listingId}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors mb-6"
      >
        <ArrowLeft size={15} />
        Back to listing
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {/* Order summary sidebar */}
        <div className="lg:col-span-1 order-2 lg:order-1">
          <div className="bg-surface border border-border rounded-2xl p-5 sticky top-6">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Order Summary</h3>
            <div className="flex gap-3 mb-4">
              <img
                src={listing.card_image_url}
                alt={listing.card_name}
                className="w-14 rounded-lg object-contain shrink-0"
                style={{ aspectRatio: '63/88' }}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{listing.card_name}</p>
                <p className="text-xs text-slate-400 truncate mt-0.5">{listing.set_name}</p>
                <p className="text-xs text-slate-500 mt-0.5">Condition: {listing.condition}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <label className="text-sm text-slate-400">Qty</label>
              <input
                type="number"
                min={1}
                max={listing.quantity}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Math.min(Number(e.target.value), listing.quantity)))}
                className="w-16 bg-elevated border border-border rounded-lg px-2 py-1 text-sm text-slate-100 focus:outline-none focus:border-accent-500 text-center"
              />
              <span className="text-xs text-slate-500">/ {listing.quantity}</span>
            </div>

            <div className="border-t border-border pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Price × {qty}</span>
                <span className="font-mono text-slate-200">{formatCHF(listing.price_chf * qty)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Shipping</span>
                <span className="text-slate-500 italic text-xs">Arranged by seller</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="font-semibold text-slate-200">Total</span>
                <span className="font-mono text-accent-400 font-bold text-base">{formatCHF(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main form area */}
        <div className="lg:col-span-2 order-1 lg:order-2">
          {/* Step tabs */}
          <div className="flex gap-1 mb-6">
            {['shipping', 'payment'].map((s, i) => (
              <div
                key={s}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  step === s ? 'bg-accent-500 text-base' : 'text-slate-500'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === s ? 'bg-white/20' : 'bg-elevated'
                }`}>{i + 1}</span>
                {s === 'shipping' ? 'Shipping' : 'Payment'}
              </div>
            ))}
          </div>

          {step === 'shipping' && (
            <form onSubmit={handleShippingContinue} className="space-y-4">
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
                onChange={(e) => setShipping({ ...shipping, shipping_address_line1: e.target.value })}
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
                  onChange={(e) => setShipping({ ...shipping, shipping_postal_code: e.target.value })}
                  required
                  data-testid="shipping-postal-code"
                />
              </div>
              <Input
                label="Country"
                placeholder="Switzerland"
                value={shipping.shipping_country}
                onChange={(e) => setShipping({ ...shipping, shipping_country: e.target.value })}
                required
                data-testid="shipping-country"
              />

              <div className="flex justify-end pt-2">
                <Button type="submit" size="lg" loading={updateProfile.isPending} data-testid="continue-to-payment">
                  Continue to Payment
                </Button>
              </div>
            </form>
          )}

          {step === 'payment' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard size={16} className="text-accent-400" />
                <h2 className="text-lg font-semibold text-slate-100">Payment</h2>
              </div>

              {/* Stripe placeholder */}
              <div className="bg-surface border border-border rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard size={18} className="text-slate-400" />
                  <p className="text-sm font-medium text-slate-300">Card details</p>
                  <span className="ml-auto text-xs bg-elevated px-2 py-0.5 rounded text-slate-500 border border-border">Stripe</span>
                </div>
                {/* Stripe Element mount point placeholder */}
                <div
                  id="stripe-payment-element"
                  className="min-h-[120px] border border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 text-slate-600 text-sm"
                >
                  <CreditCard size={28} className="text-slate-700" />
                  <span>Stripe Payment Element loads here</span>
                  <span className="text-xs text-slate-700">(Stripe integration pending)</span>
                </div>
              </div>

              <div className="bg-elevated border border-border rounded-xl px-4 py-3 text-xs text-slate-500">
                <span className="text-slate-400 font-medium">Ship to:</span>{' '}
                {shipping.shipping_name}, {shipping.shipping_address_line1},{' '}
                {shipping.shipping_city} {shipping.shipping_postal_code},{' '}
                {shipping.shipping_country}
                {' '}·{' '}
                <button
                  type="button"
                  onClick={() => setStep('shipping')}
                  className="text-accent-400 hover:underline"
                >
                  Edit
                </button>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <Button variant="secondary" onClick={() => setStep('shipping')}>Back</Button>
                <Button size="lg" onClick={handlePlaceOrder} loading={createOrder.isPending} data-testid="place-order-btn">
                  Place Order · {formatCHF(total)}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  )
}
