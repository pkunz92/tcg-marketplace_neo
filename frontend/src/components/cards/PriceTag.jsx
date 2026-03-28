import { formatCHF } from '../../lib/utils'

export default function PriceTag({ price, className = '' }) {
  return (
    <span className={`font-mono font-semibold text-accent-400 ${className}`}>
      {price != null ? formatCHF(price) : '—'}
    </span>
  )
}
