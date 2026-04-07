import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Pricing | TCG Marketplace',
  description:
    'Simple, transparent fees for selling on TCG Marketplace. No listing fees, just a low commission when your card sells.',
}

const feeRows = [
  { label: 'Listing fee', value: 'Free', note: 'Always free to list' },
  { label: 'Sales commission', value: '6%', note: 'On final sale price (incl. shipping)' },
  { label: 'Payment processing', value: '2.9% + CHF 0.30', note: 'Stripe fee, passed through at cost' },
  { label: 'Payout to bank', value: 'Free', note: 'Standard 2-business-day transfer' },
  { label: 'Instant payout', value: 'CHF 0.50', note: 'Per payout, arrive in minutes' },
]

const shippingRows = [
  { zone: 'Switzerland (domestic)', tracked: 'CHF 5.00', standard: 'CHF 3.50' },
  { zone: 'Europe (EU + EEA)', tracked: 'CHF 12.00', standard: 'CHF 8.00' },
  { zone: 'North America', tracked: 'CHF 18.00', standard: 'CHF 14.00' },
  { zone: 'Rest of World', tracked: 'CHF 22.00', standard: 'CHF 18.00' },
]

export default function PricingPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-12 py-8">
      {/* Hero */}
      <section className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-accent-500/10 border border-accent-500/20 px-4 py-1.5 text-sm text-accent-400 font-medium mb-2">
          Pricing
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-slate-100 leading-tight">
          Simple, <span className="gradient-text">transparent</span> fees
        </h1>
        <p className="text-lg text-slate-400 max-w-xl mx-auto">
          No listing fees. No monthly subscriptions. Pay a small commission only when you make a sale.
        </p>
      </section>

      {/* Fee table */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-100">Seller Fees</h2>
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wide">Fee</th>
                <th className="text-right px-5 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wide">Amount</th>
                <th className="text-right px-5 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wide hidden sm:table-cell">Note</th>
              </tr>
            </thead>
            <tbody>
              {feeRows.map((row, i) => (
                <tr key={row.label} className={i < feeRows.length - 1 ? 'border-b border-border' : ''}>
                  <td className="px-5 py-3.5 text-slate-200">{row.label}</td>
                  <td className="px-5 py-3.5 text-right font-semibold text-accent-400 font-mono whitespace-nowrap">
                    {row.value}
                  </td>
                  <td className="px-5 py-3.5 text-right text-slate-500 hidden sm:table-cell">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Example calculation */}
        <div className="bg-elevated border border-border rounded-2xl p-5 space-y-3">
          <p className="text-sm font-semibold text-slate-200">Example: Selling a card for CHF 50.00</p>
          <div className="space-y-1.5 text-sm">
            {[
              { label: 'Sale price', amount: 'CHF 50.00', positive: true },
              { label: '6% commission', amount: '− CHF 3.00', positive: false },
              { label: 'Stripe fee (2.9% + 0.30)', amount: '− CHF 1.75', positive: false },
            ].map((r) => (
              <div key={r.label} className="flex justify-between">
                <span className="text-slate-400">{r.label}</span>
                <span className={r.positive ? 'text-slate-200 font-medium' : 'text-slate-400'}>{r.amount}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-border pt-2 mt-2">
              <span className="font-semibold text-slate-100">You receive</span>
              <span className="font-bold text-emerald-400">CHF 45.25</span>
            </div>
          </div>
        </div>
      </section>

      {/* Shipping */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-100">Shipping Rates</h2>
        <p className="text-sm text-slate-400">
          Sellers set their own shipping price. The table below shows recommended rates for a standard bubble-mailer up to 100 g.
        </p>
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wide">Zone</th>
                <th className="text-right px-5 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wide">Tracked</th>
                <th className="text-right px-5 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wide">Standard</th>
              </tr>
            </thead>
            <tbody>
              {shippingRows.map((row, i) => (
                <tr key={row.zone} className={i < shippingRows.length - 1 ? 'border-b border-border' : ''}>
                  <td className="px-5 py-3.5 text-slate-200">{row.zone}</td>
                  <td className="px-5 py-3.5 text-right text-slate-300 font-mono">{row.tracked}</td>
                  <td className="px-5 py-3.5 text-right text-slate-400 font-mono">{row.standard}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* CTA */}
      <section className="text-center space-y-4 bg-surface border border-border rounded-3xl p-8">
        <h2 className="text-xl font-bold text-slate-100">Ready to start selling?</h2>
        <p className="text-slate-400 text-sm">List your first card for free — no credit card required.</p>
        <Link
          href="/market/new"
          className="inline-flex items-center gap-2 rounded-xl bg-accent-gradient px-6 py-3 text-sm font-semibold text-white shadow-glow-sm hover:shadow-glow-accent hover:scale-105 transition-all"
        >
          List a Card
        </Link>
      </section>
    </div>
  )
}
