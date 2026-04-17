'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { api, ApiError } from '@/lib/api'
import Button from '@/components/ui/button'
import Input from '@/components/ui/input'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const uid = searchParams.get('uid') ?? ''
  const token = searchParams.get('token') ?? ''

  const [newPassword1, setNewPassword1] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/password/reset/confirm/', {
        uid,
        token,
        new_password1: newPassword1,
        new_password2: newPassword2,
      })
      router.push('/login?reset=1')
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

  if (!uid || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <div className="w-full max-w-sm">
          <div className="bg-elevated border border-border rounded-xl p-6 shadow-lg text-center space-y-4">
            <p className="text-sm text-red-400">
              Invalid or missing reset link. Please request a new one.
            </p>
            <Link href="/forgot-password" className="text-accent-400 hover:text-accent-300 font-medium text-sm">
              Request new reset link
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-100">Set new password</h1>
          <p className="mt-1 text-sm text-slate-400">
            Choose a strong password for your account
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-elevated border border-border rounded-xl p-6 space-y-4 shadow-lg"
        >
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            value={newPassword1}
            onChange={(e) => setNewPassword1(e.target.value)}
            required
          />
          <Input
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={newPassword2}
            onChange={(e) => setNewPassword2(e.target.value)}
            required
          />

          {error && (
            <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" loading={loading} className="w-full" size="md">
            Reset password
          </Button>
        </form>

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

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
