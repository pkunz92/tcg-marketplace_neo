import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About Us | TCG Marketplace',
  description:
    'Learn about TCG Marketplace — our mission to make trading Pokémon cards fast, safe, and fair for collectors worldwide.',
}

const team = [
  {
    name: 'Alex Chen',
    role: 'Co-founder & CEO',
    bio: 'Lifelong Pokémon collector turned entrepreneur. Built TCG Marketplace to solve the trust problem in online card trading.',
    initials: 'AC',
  },
  {
    name: 'Maria Schulz',
    role: 'Co-founder & CTO',
    bio: 'Former machine-learning engineer at a leading fintech. Designed our AI pre-grading engine from scratch.',
    initials: 'MS',
  },
  {
    name: 'Luca Ferretti',
    role: 'Head of Operations',
    bio: 'Expert in cross-border logistics. Streamlined our shipping pipeline to cover 40+ countries.',
    initials: 'LF',
  },
]

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-16 py-8">
      {/* Hero */}
      <section className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-accent-500/10 border border-accent-500/20 px-4 py-1.5 text-sm text-accent-400 font-medium mb-2">
          Our Story
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-slate-100 leading-tight">
          Trading cards deserve a<br />
          <span className="gradient-text">better marketplace</span>
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          TCG Marketplace was built by collectors, for collectors. We got tired of blurry photos,
          disputed conditions, and slow payouts — so we built the platform we always wished existed.
        </p>
      </section>

      {/* Mission */}
      <section className="bg-surface border border-border rounded-3xl p-8 space-y-4">
        <h2 className="text-2xl font-bold text-slate-100">Our Mission</h2>
        <p className="text-slate-400 leading-relaxed">
          Make buying and selling trading cards as fast, transparent, and trustworthy as possible.
          Every feature we ship — from mandatory photo uploads on high-value cards to our AI
          pre-grading engine — is designed to give buyers confidence and help sellers get fair prices.
        </p>
        <div className="grid sm:grid-cols-3 gap-4 pt-2">
          {[
            { label: 'Cards Listed', value: '50 000+' },
            { label: 'Happy Traders', value: '12 000+' },
            { label: 'Countries Served', value: '40+' },
          ].map((stat) => (
            <div key={stat.label} className="bg-elevated rounded-2xl p-4 text-center">
              <p className="text-3xl font-black gradient-text">{stat.value}</p>
              <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Values */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-100">What We Stand For</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            {
              title: 'Transparency',
              desc: 'Every listing must accurately represent the card. AI grading and photo verification keep everyone honest.',
            },
            {
              title: 'Speed',
              desc: 'List a card in under 60 seconds. Bulk upload tools let serious sellers move their whole collection overnight.',
            },
            {
              title: 'Fairness',
              desc: 'Competitive commission, no hidden fees. Sellers keep more of what they earn.',
            },
            {
              title: 'Community',
              desc: 'Collectors helping collectors. Our marketplace grows when every transaction builds trust.',
            },
          ].map((v) => (
            <div key={v.title} className="bg-surface border border-border rounded-2xl p-5 space-y-2">
              <h3 className="font-semibold text-slate-100">{v.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Team */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-100">Meet the Team</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {team.map((member) => (
            <div key={member.name} className="bg-surface border border-border rounded-2xl p-5 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-accent-gradient flex items-center justify-center text-white font-black shadow-glow-sm">
                {member.initials}
              </div>
              <div>
                <p className="font-semibold text-slate-100">{member.name}</p>
                <p className="text-xs text-accent-400 mt-0.5">{member.role}</p>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">{member.bio}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
