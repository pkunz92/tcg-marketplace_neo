'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, ApiError } from '@/lib/api'
import Button from '@/components/ui/button'
import Input from '@/components/ui/input'

interface RegisterPayload {
  username: string
  email: string
  password1: string
  password2: string
  shipping_name: string
  shipping_address_line1: string
  shipping_city: string
  shipping_postal_code: string
  shipping_country: string
}

export default function RegisterPage() {
  const router = useRouter()

  const [form, setForm] = useState<RegisterPayload>({
    username: '',
    email: '',
    password1: '',
    password2: '',
    shipping_name: '',
    shipping_address_line1: '',
    shipping_city: '',
    shipping_postal_code: '',
    shipping_country: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(field: keyof RegisterPayload) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password1 !== form.password2) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/registration/', form)
      // After registration, redirect to login (email verification may be required)
      router.push('/login')
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail)
      } else {
        setError('Registration failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-100">Create account</h1>
          <p className="mt-1 text-sm text-slate-400">
            Join TCG Marketplace — buy and sell trading cards
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-elevated border border-border rounded-xl p-6 space-y-4 shadow-lg"
        >
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Account details
          </p>
          <Input
            label="Username"
            type="text"
            autoComplete="username"
            value={form.username}
            onChange={set('username')}
            data-testid="register-username"
            required
          />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={set('email')}
            data-testid="register-email"
            required
          />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            value={form.password1}
            onChange={set('password1')}
            data-testid="register-password1"
            required
          />
          <Input
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={form.password2}
            onChange={set('password2')}
            data-testid="register-password2"
            required
          />

          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider pt-2">
            Shipping address
          </p>
          <Input
            label="Full name"
            type="text"
            autoComplete="name"
            value={form.shipping_name}
            onChange={set('shipping_name')}
            data-testid="register-shipping-name"
            required
          />
          <Input
            label="Address"
            type="text"
            autoComplete="street-address"
            value={form.shipping_address_line1}
            onChange={set('shipping_address_line1')}
            data-testid="register-shipping-address"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="City"
              type="text"
              autoComplete="address-level2"
              value={form.shipping_city}
              onChange={set('shipping_city')}
              data-testid="register-shipping-city"
              required
            />
            <Input
              label="Postal code"
              type="text"
              autoComplete="postal-code"
              value={form.shipping_postal_code}
              onChange={set('shipping_postal_code')}
              data-testid="register-shipping-postal-code"
              required
            />
          </div>
          <Input
            label="Country"
            type="text"
            autoComplete="country-name"
            value={form.shipping_country}
            onChange={set('shipping_country')}
            data-testid="register-shipping-country"
            required
          />

          {error && (
            <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" loading={loading} className="w-full" size="md" data-testid="register-submit">
            Create account
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link href="/login" className="text-accent-400 hover:text-accent-300 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
