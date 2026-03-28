import { CONDITION_LABELS } from '../../lib/utils'

export default function ConditionBadge({ condition }) {
  const meta = CONDITION_LABELS[condition] || { label: condition, color: 'text-slate-400' }
  return (
    <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
  )
}
