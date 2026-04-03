import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6">
      <h1 className="text-4xl font-bold text-slate-100">TCG Marketplace</h1>
      <p className="text-slate-400 max-w-md">
        Buy and sell Pokémon cards with confidence. Instant pricing, photo verification,
        and secure payments.
      </p>
      <div className="flex gap-3">
        <Link
          href="/market"
          className="rounded-lg bg-accent-500 px-5 py-2.5 font-medium text-white hover:bg-accent-600 transition-colors"
        >
          Browse Market
        </Link>
        <Link
          href="/cards"
          className="rounded-lg border border-border bg-elevated px-5 py-2.5 font-medium text-slate-200 hover:bg-border transition-colors"
        >
          Explore Cards
        </Link>
      </div>
    </div>
  )
}
