'use client'

import { useState } from 'react'
import Link from 'next/link'
import { api, ApiError } from '@/lib/api'
import Button from '@/components/ui/button'
import Input from '@/components/ui/input'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/password/reset/', { email })
      setSubmitted(true)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail)
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-100">Forgot password</h1>
          <p className="mt-1 text-sm text-slate-400">
            Enter your email and we&apos;ll send you a reset link
          </p>
        </div>

        {submitted ? (
          <div className="bg-elevated border border-border rounded-xl p-6 shadow-lg text-center space-y-4">
            <p className="text-sm text-slate-200">
              Check your email for a password reset link.
            </p>
            <p className="text-sm text-slate-400">
              Didn&apos;t receive it? Check your spam folder or{' '}
              <button
                className="text-accent-400 hover:text-accent-300 font-medium"
                onClick={() => setSubmitted(false)}
              >
                try again
              </button>
              .
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-elevated border border-border rounded-xl p-6 space-y-4 shadow-lg"
          >
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            {error && (
              <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" loading={loading} className="w-full" size="md">
              Send reset link
            </Button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-slate-400">
          Remember your password?{' '}
          <Link href="/login" className="text-accent-400 hover:text-accent-300 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
