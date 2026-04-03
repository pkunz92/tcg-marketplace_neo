'use client'

import { useState } from 'react'
import { Info, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ConditionCode } from '@/lib/api'

const CONDITION_LABELS: Record<ConditionCode, string> = {
  MT: 'Mint',
  NM: 'Near Mint',
  LP: 'Lightly Played',
  MP: 'Moderately Played',
  HP: 'Heavily Played',
  DMG: 'Damaged',
}

interface GradingBadgeProps {
  condition: ConditionCode
  confidence: number
  className?: string
}

export default function GradingBadge({ condition, confidence, className }: GradingBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const pct = Math.round(confidence * 100)

  const colorClass =
    confidence >= 0.8
      ? 'bg-green-500/15 text-green-400 border-green-500/30'
      : confidence >= 0.6
        ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
        : 'bg-red-500/15 text-red-400 border-red-500/30'

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border',
            colorClass,
          )}
        >
          {CONDITION_LABELS[condition]} ({pct}% confidence)
        </span>

        {/* Tooltip trigger */}
        <button
          type="button"
          onClick={() => setShowTooltip((v) => !v)}
          className="text-slate-500 hover:text-slate-300 transition-colors"
          aria-label="Photo quality tips"
        >
          <Info size={14} />
        </button>
      </div>

      {confidence < 0.6 && (
        <div className="flex items-start gap-2 text-red-400 bg-red-400/10 rounded-lg px-3 py-2 text-xs">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <span>
            Photo quality may be insufficient — consider retaking.{' '}
            <button
              type="button"
              onClick={() => setShowTooltip((v) => !v)}
              className="underline underline-offset-2 hover:text-red-300"
            >
              Tips for better photos
            </button>
          </span>
        </div>
      )}

      {showTooltip && (
        <div className="bg-elevated border border-border rounded-xl p-4 text-xs text-slate-300 space-y-2">
          <p className="font-semibold text-slate-200">Tips for accurate AI grading:</p>
          <ul className="space-y-1 list-disc list-inside text-slate-400">
            <li>Use good, even lighting — avoid harsh shadows or glare</li>
            <li>Lay the card flat on a plain, dark background</li>
            <li>Fill the frame with the card — keep margins small</li>
            <li>Capture both front and back at full resolution</li>
            <li>Avoid motion blur — use a stable surface or tripod</li>
          </ul>
          <button
            type="button"
            onClick={() => setShowTooltip(false)}
            className="text-accent-400 hover:text-accent-300 mt-1"
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}
