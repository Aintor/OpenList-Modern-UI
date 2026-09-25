import React from 'react'
import { Disc3, Loader2 } from 'lucide-react'

export interface VinylRecordProps {
  size?: number | string
  coverUrl?: string | null
  loading?: boolean
  duration?: number
  isPlaying?: boolean
  alt?: string
  className?: string
}

export const VinylRecord: React.FC<VinylRecordProps> = ({
  size = 40,
  coverUrl,
  loading,
  duration,
  isPlaying,
  alt = '',
  className = '',
}) => {
  const isSpinning = isPlaying && (duration !== undefined ? duration > 0 : true) && !loading
  return (
    <div
      className={`relative flex items-center justify-center shrink-0 rounded-full bg-slate-950/90 border-2 transition-colors duration-300 overflow-hidden shadow-inner ${
        isSpinning ? 'border-indigo-500 text-indigo-400' : 'border-slate-300/80 dark:border-white/20 text-slate-400'
      } ${className}`}
      style={{ width: size, height: size }}
    >
      {coverUrl ? (
        <img
          src={coverUrl}
          alt={alt}
          className="h-full w-full object-cover animate-spin rounded-full"
          style={{
            animationDuration: '6s',
            animationPlayState: isSpinning ? 'running' : 'paused',
          }}
        />
      ) : (loading || duration === 0) && isPlaying ? (
        <Loader2 className="h-1/2 w-1/2 animate-spin text-indigo-400" />
      ) : (
        <Disc3
          className="h-3/4 w-3/4 animate-spin transition-opacity"
          style={{
            animationDuration: '4s',
            animationPlayState: isSpinning ? 'running' : 'paused',
            opacity: isSpinning ? 1 : 0.65,
          }}
        />
      )}
    </div>
  )
}
