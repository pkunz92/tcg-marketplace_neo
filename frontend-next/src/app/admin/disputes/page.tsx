'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { api, type Dispute } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import Spinner from '@/components/ui/spinner'
import { useAuth } from '@/lib/auth-context'

const REASON_LABELS: Record<string, string> = {
  not_received: 'Item Not Received',
  not_as_described: 'Item Not As Described',
  unauthorized: 'Unauthorized Payment',
  other: 'Other',
}

function StatusBadge({ status }: { status: Dispute['status'] }) {
  const variants: Record<Dispute['status'], string> = {
    open: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    resolved: 'bg-green-500/10 text-green-400 border-green-500/20',
    closed: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${variants[status]}`}>
      {status}
    </span>
  )
}

function ResolveModal({
  dispute,
  onClose,
  onResolved,
}: {
  dispute: Dispute
  onClose: () => void
  onResolved: () => void
}) {
  const [resolution, setResolution] = useState('')
  const [refund, setRefund] = useState(false)
  const [close, setClose] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!resolution.trim()) {
      setError('Resolution note is required.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await api.patch(`/disputes/${dispute.id}/`, { resolution, refund, close })
      onResolved()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resolve dispute.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h2 className="text-base font-semibold text-slate-100 mb-1">
          Resolve Dispute #{dispute.id}
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Order #{dispute.order_id} — {REASON_LABELS[dispute.reason] ?? dispute.reason}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Resolution note</label>
            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              rows={3}
              placeholder="Describe how this dispute was handled…"
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-slate-200 resize-none"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={refund}
              onChange={(e) => setRefund(e.target.checked)}
              className="accent-accent-400"
            />
            <span className="text-sm text-slate-300">Issue Stripe refund</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={close}
              onChange={(e) => setClose(e.target.checked)}
              className="accent-accent-400"
            />
            <span className="text-sm text-slate-300">Close without resolution (reject)</span>
          </label>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 rounded-lg bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              {submitting ? 'Saving…' : close ? 'Close dispute' : 'Resolve dispute'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminDisputesPage() {
  const { user } = useAuth()
  const [statusFilter, setStatusFilter] = useState<'open' | 'resolved' | 'closed'>('open')
  const [resolving, setResolving] = useState<Dispute | null>(null)

  const { data: disputes, isLoading, mutate } = useSWR(
    `admin-disputes-${statusFilter}`,
    () => api.get<Dispute[]>(`/disputes/?status=${statusFilter}`),
  )

  if (!user) {
    return <p className="text-slate-400 text-center py-32">Loading…</p>
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <AlertTriangle size={20} className="text-yellow-400" />
        <h1 className="text-xl font-semibold text-slate-100">Disputes</h1>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 bg-surface border border-border rounded-xl p-1 w-fit">
        {(['open', 'resolved', 'closed'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              statusFilter === s
                ? 'bg-accent-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      )}

      {!isLoading && disputes?.length === 0 && (
        <p className="text-slate-500 text-center py-20">No {statusFilter} disputes.</p>
      )}

      {!isLoading && disputes && disputes.length > 0 && (
        <div className="space-y-3">
          {disputes.map((d) => (
            <div
              key={d.id}
              className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-100">
                    Dispute #{d.id}
                  </span>
                  <StatusBadge status={d.status} />
                </div>
                <p className="text-xs text-slate-400 mb-0.5">
                  Order{' '}
                  <Link href={`/orders/${d.order_id}`} className="text-accent-400 hover:underline">
                    #{d.order_id}
                  </Link>{' '}
                  · Opened by <span className="text-slate-300">{d.opened_by_username}</span>
                </p>
                <p className="text-xs text-slate-500 mb-1">
                  Reason: {REASON_LABELS[d.reason] ?? d.reason} · {formatDate(d.created_at)}
                </p>
                <p className="text-sm text-slate-300 line-clamp-2">{d.description}</p>
                {d.resolution && (
                  <p className="text-xs text-green-400 mt-1">
                    Resolution: {d.resolution}
                  </p>
                )}
              </div>

              {d.status === 'open' && (
                <button
                  onClick={() => setResolving(d)}
                  className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium transition-colors"
                >
                  <CheckCircle size={14} />
                  Resolve
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {resolving && (
        <ResolveModal
          dispute={resolving}
          onClose={() => setResolving(null)}
          onResolved={() => {
            setResolving(null)
            mutate()
          }}
        />
      )}
    </div>
  )
}
