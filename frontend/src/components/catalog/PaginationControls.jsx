import { ChevronLeft, ChevronRight } from 'lucide-react'
import Button from '../ui/Button'

export default function PaginationControls({ page, totalCount, pageSize = 50, onPage }) {
  const totalPages = Math.ceil(totalCount / pageSize)
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-4 py-6">
      <Button
        variant="secondary"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        <ChevronLeft size={16} /> Prev
      </Button>
      <span className="text-sm text-slate-400">
        Page <span className="text-slate-200 font-medium">{page}</span> of{' '}
        <span className="text-slate-200 font-medium">{totalPages}</span>
        <span className="text-slate-500 ml-2">({totalCount.toLocaleString()} cards)</span>
      </span>
      <Button
        variant="secondary"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        Next <ChevronRight size={16} />
      </Button>
    </div>
  )
}
