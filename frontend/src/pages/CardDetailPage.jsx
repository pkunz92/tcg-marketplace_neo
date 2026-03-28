import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Zap } from 'lucide-react'
import { useCardStats } from '../hooks/useCards'
import CardImage from '../components/cards/CardImage'
import { RarityBadge, TypeBadge, SupertypeBadge } from '../components/cards/CardBadge'
import { formatCHF, formatDate, CONDITION_LABELS, GRADING_LABELS } from '../lib/utils'
import PriceTag from '../components/cards/PriceTag'
import PageContainer from '../components/layout/PageContainer'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import { useState } from 'react'
import BuyModal from '../components/marketplace/BuyModal'
import { useAuth } from '../context/AuthContext'

function Section({ title, children }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">{title}</h2>
      {children}
    </div>
  )
}

function AttackRow({ attack }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className="flex gap-1 mt-0.5 shrink-0">
        {(attack.cost || []).map((c, i) => (
          <span key={i} className="w-4 h-4 rounded-full bg-elevated border border-border text-[9px] flex items-center justify-center text-slate-400">
            {c[0]}
          </span>
        ))}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-200">{attack.name}</span>
          <span className="font-mono text-sm text-slate-300">{attack.damage}</span>
        </div>
        {attack.text && <p className="text-xs text-slate-500 mt-0.5">{attack.text}</p>}
      </div>
    </div>
  )
}

function ListingRow({ listing, onBuy }) {
  const cond = CONDITION_LABELS[listing.condition] || { label: listing.condition, color: 'text-slate-400' }
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div>
        <p className="text-sm text-slate-200">{listing.seller_username}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-xs ${cond.color}`}>{cond.label}</span>
          {listing.is_graded && (
            <span className="text-xs text-blue-400">{GRADING_LABELS[listing.grading_company] || listing.grading_company}</span>
          )}
          <span className="text-xs text-slate-500">Qty: {listing.quantity}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <PriceTag price={listing.price_chf} />
        <Button size="sm" onClick={() => onBuy(listing)}>Buy</Button>
      </div>
    </div>
  )
}

export default function CardDetailPage() {
  const { apiId } = useParams()
  const { data, isLoading } = useCardStats(apiId)
  const { isAuthenticated } = useAuth()
  const [buyListing, setBuyListing] = useState(null)

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>
  )
  if (!data) return (
    <PageContainer><p className="text-slate-400">Card not found.</p></PageContainer>
  )

  const { card, listings = [], market_prices = [], statistics } = data
  const types = Array.isArray(card.types) ? card.types : []
  const attacks = Array.isArray(card.attacks) ? card.attacks : []
  const abilities = Array.isArray(card.abilities) ? card.abilities : []
  const weaknesses = Array.isArray(card.weaknesses) ? card.weaknesses : []

  return (
    <PageContainer>
      <Link to="/cards" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 mb-6 transition-colors">
        <ArrowLeft size={15} /> Back to catalog
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card image */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <CardImage
              src={card.image_url}
              alt={card.card_name}
              className="w-full max-w-sm mx-auto aspect-[63/88] rounded-xl"
            />
            {card.artist && (
              <p className="text-center text-xs text-slate-500 mt-2">Illustrated by <span className="text-slate-400">{card.artist}</span></p>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Header */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <SupertypeBadge supertype={card.supertype} />
              {types.map((t) => <TypeBadge key={t} type={t} />)}
              <RarityBadge rarity={card.card_rarity} />
            </div>
            <h1 className="text-3xl font-bold text-slate-100">{card.card_name}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
              <span>#{card.card_number}</span>
              {card.set && <Link to={`/cards?set_code=${card.set.set_code}`} className="hover:text-accent-400 transition-colors">{card.set.set_name}</Link>}
              {card.hp && <span className="text-slate-300">HP <strong>{card.hp}</strong></span>}
            </div>
            {card.flavor_text && (
              <p className="mt-3 text-sm italic text-slate-400 border-l-2 border-accent-500/40 pl-3">{card.flavor_text}</p>
            )}
          </div>

          {/* Price stats */}
          {statistics && (
            <Section title="Market Overview">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-slate-500">Lowest Ask</p>
                  <PriceTag price={statistics.min_price} className="text-lg" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Average</p>
                  <PriceTag price={statistics.avg_price} className="text-lg" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Highest Ask</p>
                  <PriceTag price={statistics.max_price} className="text-lg" />
                </div>
              </div>
              <p className="text-center text-xs text-slate-500 mt-3">
                {statistics.total_listings} active listing{statistics.total_listings !== 1 ? 's' : ''}
              </p>
            </Section>
          )}

          {/* Attacks */}
          {attacks.length > 0 && (
            <Section title="Attacks">
              {attacks.map((a, i) => <AttackRow key={i} attack={a} />)}
            </Section>
          )}

          {/* Abilities */}
          {abilities.length > 0 && (
            <Section title="Abilities">
              {abilities.map((a, i) => (
                <div key={i} className="py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-1.5 py-0.5 bg-purple-900/50 text-purple-300 rounded">{a.type}</span>
                    <span className="text-sm font-medium text-slate-200">{a.name}</span>
                  </div>
                  {a.text && <p className="text-xs text-slate-500 mt-1">{a.text}</p>}
                </div>
              ))}
            </Section>
          )}

          {/* Weaknesses */}
          {weaknesses.length > 0 && (
            <Section title="Weaknesses & Retreat">
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Weakness</p>
                  <div className="flex gap-1.5">
                    {weaknesses.map((w, i) => (
                      <span key={i} className="text-xs bg-red-950 border border-red-800 text-red-300 rounded px-2 py-0.5">{w.type} {w.value}</span>
                    ))}
                  </div>
                </div>
                {card.retreat_cost != null && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Retreat</p>
                    <span className="text-sm text-slate-300">{card.retreat_cost} ✦</span>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Market prices */}
          {market_prices.length > 0 && (
            <Section title="Price Data">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500 text-left border-b border-border">
                      <th className="pb-2 font-medium">Source</th>
                      <th className="pb-2 font-medium">Variant</th>
                      <th className="pb-2 font-medium text-right">Low</th>
                      <th className="pb-2 font-medium text-right">Market</th>
                      <th className="pb-2 font-medium text-right">High</th>
                    </tr>
                  </thead>
                  <tbody>
                    {market_prices.map((p, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="py-2 text-slate-300">{p.source}</td>
                        <td className="py-2 text-slate-400 capitalize">{p.variant || '—'}</td>
                        <td className="py-2 text-right font-mono text-slate-300">{p.low ? formatCHF(p.low) : '—'}</td>
                        <td className="py-2 text-right font-mono text-accent-400">{p.market ? formatCHF(p.market) : '—'}</td>
                        <td className="py-2 text-right font-mono text-slate-300">{p.high ? formatCHF(p.high) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Active listings */}
          <Section title={`Active Listings (${listings.length})`}>
            {listings.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">No listings for this card yet.</p>
            ) : (
              <>
                {listings.slice(0, 10).map((l) => (
                  <ListingRow key={l.id} listing={l} onBuy={setBuyListing} />
                ))}
                {!isAuthenticated && (
                  <p className="text-xs text-slate-500 mt-3 text-center">
                    <Link to="/login" className="text-accent-500 hover:underline">Sign in</Link> to purchase
                  </p>
                )}
              </>
            )}
          </Section>
        </div>
      </div>

      {buyListing && (
        <BuyModal listing={buyListing} card={card} onClose={() => setBuyListing(null)} />
      )}
    </PageContainer>
  )
}
