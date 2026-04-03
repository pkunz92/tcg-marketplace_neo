import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCHF(amount: number | string): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount
  return `CHF ${n.toFixed(2)}`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str
}
