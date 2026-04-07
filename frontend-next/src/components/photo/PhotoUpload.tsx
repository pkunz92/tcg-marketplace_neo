'use client'

import { useCallback, useRef, useState } from 'react'
import Image from 'next/image'
import { Camera, Upload, X, AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api, type AnalyzePhotoResponse } from '@/lib/api'

export interface PhotoUploadProps {
  required: boolean
  onPhotoSelected: (file: File) => void
  onAnalysisComplete?: (result: AnalyzePhotoResponse) => void
  onClear?: () => void
  className?: string
}

type AnalysisState =
  | { status: 'idle' }
  | { status: 'analyzing' }
  | { status: 'done'; result: AnalyzePhotoResponse }
  | { status: 'error'; message: string }

export default function PhotoUpload({
  required,
  onPhotoSelected,
  onAnalysisComplete,
  onClear,
  className,
}: PhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisState>({ status: 'idle' })
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(
    async (file: File) => {
      const url = URL.createObjectURL(file)
      setPreview(url)
      onPhotoSelected(file)
      setAnalysis({ status: 'analyzing' })

      const formData = new FormData()
      formData.append('photo', file)
      try {
        const result = await api.postForm<AnalyzePhotoResponse>(
          '/listings/analyze-photo/',
          formData,
        )
        setAnalysis({ status: 'done', result })
        onAnalysisComplete?.(result)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Analysis failed'
        setAnalysis({ status: 'error', message })
      }
    },
    [onPhotoSelected, onAnalysisComplete],
  )

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) processFile(file)
  }

  function handleClear() {
    setPreview(null)
    setAnalysis({ status: 'idle' })
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
    onClear?.()
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-200">
          Photo{' '}
          {required ? (
            <span className="ml-1 text-xs font-semibold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
              Required for high-value cards
            </span>
          ) : (
            <span className="ml-1 text-xs text-slate-500">(optional)</span>
          )}
        </label>
        {preview && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1 transition-colors"
          >
            <X size={12} /> Remove
          </button>
        )}
      </div>

      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-border bg-surface">
          <div className="relative w-full h-48">
            <Image src={preview} alt="Card photo preview" fill className="object-contain p-2" />
          </div>

          {/* Analysis status overlay */}
          {analysis.status === 'analyzing' && (
            <div className="absolute inset-0 bg-base/70 flex flex-col items-center justify-center gap-2">
              <Loader2 size={24} className="text-accent-400 animate-spin" />
              <p className="text-sm text-slate-300">Analyzing photo…</p>
            </div>
          )}

          {analysis.status === 'error' && (
            <div className="mt-2 mx-3 mb-3 flex items-start gap-2 text-amber-400 bg-amber-400/10 rounded-lg px-3 py-2 text-xs">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>{analysis.status === 'error' ? analysis.message : ''}</span>
            </div>
          )}
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer',
            dragging
              ? 'border-accent-500 bg-accent-500/5'
              : required
                ? 'border-amber-500/50 bg-amber-500/5 hover:border-amber-400'
                : 'border-border bg-surface hover:border-accent-500/50',
          )}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        >
          <Upload
            size={28}
            className={cn('mx-auto mb-3', required ? 'text-amber-400/60' : 'text-slate-600')}
          />
          <p className="text-sm font-medium text-slate-300">
            {required ? 'Photo required for high-value cards' : 'Add a photo of your card'}
          </p>
          <p className="text-xs text-slate-500 mt-1">Drag & drop or click to browse</p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                fileInputRef.current?.click()
              }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-elevated text-slate-300 hover:bg-border transition-colors"
            >
              <Upload size={12} /> Browse files
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                cameraInputRef.current?.click()
              }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-elevated text-slate-300 hover:bg-border transition-colors"
            >
              <Camera size={12} /> Camera
            </button>
          </div>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {analysis.status === 'done' && analysis.result.photo_quality.warnings.length > 0 && (
        <div className="flex items-start gap-2 text-amber-400 bg-amber-400/10 rounded-lg px-3 py-2 text-xs">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{analysis.result.photo_quality.warnings.join('. ')}</span>
        </div>
      )}
    </div>
  )
}
