import { useState } from 'react'
import { cn } from '../../lib/utils'

export default function CardFlipWrapper({ front, back, className }) {
  const [flipped, setFlipped] = useState(false)
  return (
    <div
      className={cn('perspective-1000 cursor-pointer', className)}
      onMouseEnter={() => setFlipped(true)}
      onMouseLeave={() => setFlipped(false)}
      onClick={() => setFlipped((v) => !v)}
    >
      <div
        className={cn(
          'relative w-full h-full preserve-3d transition-transform duration-500',
          flipped && 'rotate-y-180',
        )}
      >
        <div className="absolute inset-0 backface-hidden">{front}</div>
        <div className="absolute inset-0 backface-hidden rotate-y-180">{back}</div>
      </div>
    </div>
  )
}
