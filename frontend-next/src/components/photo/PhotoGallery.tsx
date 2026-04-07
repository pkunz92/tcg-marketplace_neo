'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X, ChevronLeft, ChevronRight, ShieldCheck, ZoomIn } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PhotoGalleryProps {
  photos: string[]
  isPhotoVerified?: boolean
  className?: string
}

export default function PhotoGallery({ photos, isPhotoVerified, className }: PhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  if (photos.length === 0) return null

  function openLightbox(i: number) {
    setLightboxIndex(i)
  }

  function closeLightbox() {
    setLightboxIndex(null)
  }

  function prev() {
    setLightboxIndex((i) => (i === null ? 0 : (i - 1 + photos.length) % photos.length))
  }

  function next() {
    setLightboxIndex((i) => (i === null ? 0 : (i + 1) % photos.length))
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-300">
          Photos{' '}
          {photos.length > 1 && (
            <span className="text-xs text-slate-500 font-normal">({photos.length})</span>
          )}
        </h3>
        {isPhotoVerified && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full">
            <ShieldCheck size={11} />
            Photo verified
          </span>
        )}
      </div>

      {/* Thumbnail grid */}
      <div className={cn('grid gap-2', photos.length === 1 ? 'grid-cols-1' : 'grid-cols-3')}>
        {photos.map((url, i) => (
          <button
            key={i}
            type="button"
            onClick={() => openLightbox(i)}
            className="relative group rounded-xl overflow-hidden border border-border bg-surface aspect-square hover:border-accent-500/50 transition-colors"
          >
            <Image
              src={url}
              alt={`Card photo ${i + 1}`}
              fill
              className="object-contain p-1.5"
              sizes="(max-width: 768px) 33vw, 200px"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-base/0 group-hover:bg-base/30 transition-colors">
              <ZoomIn size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-base/95 backdrop-blur-sm"
          onClick={closeLightbox}
        >
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 transition-colors p-2 rounded-lg hover:bg-elevated"
          >
            <X size={20} />
          </button>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  prev()
                }}
                className="absolute left-4 text-slate-400 hover:text-slate-100 transition-colors p-2 rounded-lg hover:bg-elevated"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  next()
                }}
                className="absolute right-4 text-slate-400 hover:text-slate-100 transition-colors p-2 rounded-lg hover:bg-elevated"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          <div
            className="relative max-w-2xl max-h-[80vh] w-full mx-16"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full h-[80vh]">
              <Image
                src={photos[lightboxIndex]}
                alt={`Card photo ${lightboxIndex + 1}`}
                fill
                className="object-contain"
                sizes="672px"
                priority
              />
            </div>
            {photos.length > 1 && (
              <p className="text-center text-xs text-slate-500 mt-2">
                {lightboxIndex + 1} / {photos.length}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
