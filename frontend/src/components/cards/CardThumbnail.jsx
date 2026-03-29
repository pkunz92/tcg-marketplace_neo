import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import CardFlipWrapper from './CardFlipWrapper'
import CardImage from './CardImage'
import { RarityBadge, TypeBadge } from './CardBadge'
import PriceTag from './PriceTag'

const LANG_FLAGS = { ja: '🇯🇵', de: '🇩🇪', fr: '🇫🇷', it: '🇮🇹', 'zh-cn': '🇨🇳', ko: '🇰🇷', es: '🇪🇸', pt: '🇧🇷' }

function CardFront({ card }) {
  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden bg-surface border border-border group-hover:border-accent-500/50 transition-colors">
      <CardImage src={card.image_url} alt={card.card_name} className="w-full h-full" />
      {card.set?.logo_url && (
        <div className="absolute bottom-2 right-2 w-10 h-5 opacity-60">
          <img src={card.set.logo_url} alt={card.set?.set_name} className="w-full h-full object-contain" />
        </div>
      )}
      {card.language && card.language !== 'en' && (
        <div className="absolute top-1.5 left-1.5 text-sm leading-none">
          {LANG_FLAGS[card.language] || card.language.toUpperCase()}
        </div>
      )}
    </div>
  )
}

function CardBack({ card }) {
  const types = Array.isArray(card.types) ? card.types : []
  return (
    <div className="w-full h-full rounded-xl bg-surface border border-accent-500/40 p-3 flex flex-col justify-between overflow-hidden">
      <div>
        <p className="text-sm font-semibold text-slate-100 truncate">{card.card_name}</p>
        <p className="text-xs text-slate-400 mt-0.5">#{card.card_number} · {card.set?.set_name}</p>
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {types.slice(0, 2).map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
        <RarityBadge rarity={card.card_rarity} />
      </div>
      {card.hp && (
        <p className="text-xs text-slate-400 mt-1">HP <span className="text-slate-200 font-medium">{card.hp}</span></p>
      )}
      <div className="mt-2 border-t border-border pt-2">
        <p className="text-xs text-slate-500">Market Price</p>
        <PriceTag price={card.market_price} className="text-sm" />
      </div>
    </div>
  )
}

export default function CardThumbnail({ card }) {
  return (
    <motion.div
      className="group"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Link to={`/cards/${card.api_id}`} className="block" style={{ aspectRatio: '63/88' }}>
        <CardFlipWrapper
          className="w-full h-full"
          front={<CardFront card={card} />}
          back={<CardBack card={card} />}
        />
      </Link>
      <div className="mt-1.5 px-0.5">
        <p className="text-xs text-slate-300 truncate font-medium">{card.card_name}</p>
        <p className="text-xs text-slate-500 truncate">{card.set?.set_name}</p>
      </div>
    </motion.div>
  )
}
