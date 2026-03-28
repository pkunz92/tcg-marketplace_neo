import { getRarityStyle, getTypeColor } from '../../lib/utils'
import Badge from '../ui/Badge'

export function RarityBadge({ rarity }) {
  return <Badge className={getRarityStyle(rarity)}>{rarity || 'Unknown'}</Badge>
}

export function TypeBadge({ type }) {
  return <Badge className={getTypeColor(type)}>{type}</Badge>
}

export function SupertypeBadge({ supertype }) {
  const styles = {
    'Pokémon': 'bg-blue-950 text-blue-300 border-blue-800',
    'Trainer': 'bg-amber-950 text-amber-300 border-amber-800',
    'Energy':  'bg-emerald-950 text-emerald-300 border-emerald-800',
  }
  return <Badge className={styles[supertype] || 'bg-slate-800 text-slate-300 border-slate-700'}>{supertype}</Badge>
}
