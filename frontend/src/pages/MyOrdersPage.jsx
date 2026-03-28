import { useMyOrders } from '../hooks/useOrders'
import PageContainer from '../components/layout/PageContainer'
import { Package } from 'lucide-react'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'
import { formatCHF, formatDate } from '../lib/utils'

export default function MyOrdersPage() {
  const { data, isLoading } = useMyOrders()
  const orders = data?.results || data || []

  const statusStyle = {
    PENDING: 'bg-yellow-950 text-yellow-400',
    COMPLETED: 'bg-green-950 text-green-400',
    CANCELLED: 'bg-red-950 text-red-400',
  }

  return (
    <PageContainer>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">My Orders</h1>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : orders.length === 0 ? (
        <EmptyState icon={Package} title="No orders yet" description="Your purchases will appear here." />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-16 shrink-0">
                  <img src={o.card_image_url} alt={o.card_name} className="w-full h-full object-contain rounded" loading="lazy" />
                </div>
                <div>
                  <p className="font-medium text-slate-200">{o.card_name}</p>
                  <p className="text-sm text-slate-400 mt-0.5">Order #{o.id} · {formatDate(o.created_at)}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Qty: {o.quantity}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono text-accent-400 font-semibold">{formatCHF(o.total_price)}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${statusStyle[o.status] || 'bg-slate-800 text-slate-400'}`}>
                  {o.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  )
}
