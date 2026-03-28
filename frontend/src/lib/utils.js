import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatCHF(amount) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
  }).format(amount)
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export const RARITY_STYLES = {
  'Common':        'bg-slate-800 text-slate-300 border-slate-700',
  'Uncommon':      'bg-green-950 text-green-300 border-green-800',
  'Rare':          'bg-blue-950 text-blue-300 border-blue-800',
  'Rare Holo':     'bg-violet-950 text-violet-300 border-violet-800',
  'Rare Holo EX':  'bg-violet-950 text-violet-300 border-violet-800',
  'Rare Holo GX':  'bg-violet-950 text-violet-300 border-violet-800',
  'Rare Holo V':   'bg-violet-950 text-violet-300 border-violet-800',
  'Rare Holo VMAX':'bg-violet-950 text-violet-300 border-violet-800',
  'Rare Holo VSTAR':'bg-violet-950 text-violet-300 border-violet-800',
  'Rare Ultra':    'bg-orange-950 text-orange-300 border-orange-800',
  'Rare Secret':   'bg-pink-950 text-pink-300 border-pink-800',
  'Amazing Rare':  'bg-cyan-950 text-cyan-300 border-cyan-800',
  'Rare Rainbow':  'bg-pink-950 text-pink-300 border-pink-800',
  'Promo':         'bg-yellow-950 text-yellow-300 border-yellow-800',
  'LEGEND':        'bg-amber-950 text-amber-300 border-amber-800',
}

export function getRarityStyle(rarity) {
  return RARITY_STYLES[rarity] || 'bg-slate-800 text-slate-400 border-slate-700'
}

export const TYPE_COLORS = {
  Fire:       'bg-red-900/60 text-red-300',
  Water:      'bg-blue-900/60 text-blue-300',
  Grass:      'bg-green-900/60 text-green-300',
  Lightning:  'bg-yellow-900/60 text-yellow-300',
  Psychic:    'bg-purple-900/60 text-purple-300',
  Fighting:   'bg-orange-900/60 text-orange-300',
  Darkness:   'bg-slate-800/80 text-slate-300',
  Metal:      'bg-slate-700/60 text-slate-200',
  Colorless:  'bg-slate-700/40 text-slate-300',
  Dragon:     'bg-indigo-900/60 text-indigo-300',
  Fairy:      'bg-pink-900/60 text-pink-300',
}

export function getTypeColor(type) {
  return TYPE_COLORS[type] || 'bg-slate-700/40 text-slate-300'
}

export const CONDITION_LABELS = {
  MT: { label: 'Mint', color: 'text-emerald-400' },
  NM: { label: 'Near Mint', color: 'text-green-400' },
  LP: { label: 'Lightly Played', color: 'text-yellow-400' },
  MP: { label: 'Moderately Played', color: 'text-orange-400' },
  HP: { label: 'Heavily Played', color: 'text-red-400' },
  DMG: { label: 'Damaged', color: 'text-red-600' },
}

export const GRADING_LABELS = {
  RAW: 'Ungraded',
  PSA: 'PSA',
  BGS: 'BGS',
  CGC: 'CGC',
  TAG: 'TAG',
  ACE: 'ACE',
}
