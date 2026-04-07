import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'How It Works | TCG Marketplace',
  description:
    'Buy and sell Pokémon cards in three easy steps. Learn how TCG Marketplace keeps every transaction fast, safe, and fair.',
}

const buyerSteps = [
  {
    step: '01',
    title: 'Browse & Search',
    desc: 'Use our marketplace to search by card name, set, condition, or price. Filter results to find exactly what you need — from Base Set Charizards to the latest Scarlet & Violet releases.',
  },
  {
    step: '02',
    title: 'Buy with Confidence',
    desc: "Every high-value card requires seller photo upload. Our AI pre-grading engine reviews condition automatically so you know what you're getting before you pay.",
  },
  {
    step: '03',
    title: 'Receive Your Cards',
    desc: 'Sellers ship within 48 hours. Track your order in real time. If anything goes wrong, our buyer protection has you covered.',
  },
]

const sellerSteps = [
  {
    step: '01',
    title: 'List in Seconds',
    desc: 'Search our card database, set your price and condition, and optionally upload a photo. Our AI pre-grades your card automatically — helping buyers trust your listing.',
  },
  {
    step: '02',
    title: 'Reach Buyers Worldwide',
    desc: 'Your listing is live on TCG Marketplace immediately. Buyers in 40+ countries can find it. Use bulk upload to list your entire collection at once.',
  },
  {
    step: '03',
    title: 'Get Paid Fast',
    desc: 'When your card sells, funds hit your account within 2 business days via Stripe. No waiting, no hidden fees — just your money.',
  },
]

export default function HowItWorksPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-16 py-8">
      {/* Hero */}
      <section className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-accent-500/10 border border-accent-500/20 px-4 py-1.5 text-sm text-accent-400 font-medium mb-2">
          How It Works
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-slate-100 leading-tight">
          Trading cards made <span className="gradient-text">simple</span>
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto">
          Whether you&apos;re buying your next grail card or clearing out your binder, TCG Marketplace
          makes the whole process fast and transparent.
        </p>
      </section>

      {/* Buyer guide */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/25 text-blue-400 text-sm font-semibold">
            For Buyers
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {buyerSteps.map((s) => (
            <div key={s.step} className="bg-surface border border-border rounded-2xl p-6 space-y-3 relative overflow-hidden">
              <span className="absolute top-4 right-4 text-5xl font-black text-slate-800 select-none leading-none">
                {s.step}
              </span>
              <h3 className="font-bold text-slate-100 text-lg">{s.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center">
          <Link
            href="/market"
            className="inline-flex items-center gap-2 rounded-xl bg-accent-gradient px-6 py-3 text-sm font-semibold text-white shadow-glow-sm hover:shadow-glow-accent hover:scale-105 transition-all"
          >
            Browse the Marketplace
          </Link>
        </div>
      </section>

      {/* Seller guide */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm font-semibold">
            For Sellers
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {sellerSteps.map((s) => (
            <div key={s.step} className="bg-surface border border-border rounded-2xl p-6 space-y-3 relative overflow-hidden">
              <span className="absolute top-4 right-4 text-5xl font-black text-slate-800 select-none leading-none">
                {s.step}
              </span>
              <h3 className="font-bold text-slate-100 text-lg">{s.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center">
          <Link
            href="/market/new"
            className="inline-flex items-center gap-2 rounded-xl bg-accent-gradient px-6 py-3 text-sm font-semibold text-white shadow-glow-sm hover:shadow-glow-accent hover:scale-105 transition-all"
          >
            List Your First Card
          </Link>
        </div>
      </section>

      {/* Trust signals */}
      <section className="bg-surface border border-border rounded-3xl p-8">
        <h2 className="text-xl font-bold text-slate-100 mb-6 text-center">Built-in Trust & Safety</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            {
              title: 'AI Pre-Grading',
              desc: 'Our computer-vision model analyses uploaded photos and assigns a condition estimate before buyers see the listing.',
            },
            {
              title: 'Photo Verification',
              desc: 'Cards valued over a threshold require real seller photos. No stock images, no surprises.',
            },
            {
              title: 'Secure Payments',
              desc: 'All payments are processed by Stripe. Funds are held in escrow until delivery is confirmed.',
            },
            {
              title: 'Buyer Protection',
              desc: "If a card arrives significantly not as described, we'll mediate and issue a refund when warranted.",
            },
          ].map((t) => (
            <div key={t.title} className="flex gap-3 items-start">
              <div className="w-2 h-2 rounded-full bg-accent-400 mt-1.5 shrink-0" />
              <div>
                <p className="font-semibold text-slate-200 text-sm">{t.title}</p>
                <p className="text-sm text-slate-400 mt-0.5 leading-relaxed">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
