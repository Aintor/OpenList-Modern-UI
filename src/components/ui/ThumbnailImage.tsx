import React, { useState, useEffect, useRef } from 'react'

interface ThumbnailImageProps {
  src: string
  alt?: string
  className?: string
  fallbackIcon: React.ReactNode
  maxRetries?: number
  initialDelay?: number
}

export const ThumbnailImage: React.FC<ThumbnailImageProps> = ({
  src,
  alt = '',
  className = '',
  fallbackIcon,
  maxRetries = 3,
  initialDelay = 1000,
}) => {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [retryCount, setRetryCount] = useState(0)
  const [imgSrc, setImgSrc] = useState(src)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // Reset when source prop changes
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setStatus('loading')
    setRetryCount(0)
    setImgSrc(src)
  }, [src])

  const handleError = () => {
    if (!mountedRef.current) return

    if (retryCount < maxRetries) {
      // Exponential backoff with jitter: 1s, 2s, 4s (+ 0~300ms jitter)
      const delay = Math.round(initialDelay * Math.pow(1.8, retryCount) + Math.random() * 300)
      const nextRetry = retryCount + 1

      timerRef.current = setTimeout(() => {
        if (!mountedRef.current) return
        setRetryCount(nextRetry)
        // Append cache-busting timestamp to bypass browser 404 caching
        const separator = src.includes('?') ? '&' : '?'
        setImgSrc(`${src}${separator}_t=${Date.now()}`)
      }, delay)
    } else {
      // Max retries reached, switch smoothly to graceful fallback icon
      setStatus('error')
    }
  }

  const handleLoad = () => {
    if (!mountedRef.current) return
    setStatus('loaded')
  }

  if (status === 'error' || !src) {
    return <>{fallbackIcon}</>
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      {/* Background Fallback/Placeholder while loading or retrying */}
      {status !== 'loaded' && (
        <div className="flex h-full w-full items-center justify-center animate-pulse opacity-70">
          {fallbackIcon}
        </div>
      )}

      {/* Main Image with smooth fade-in transition on success */}
      <img
        src={imgSrc}
        alt={alt}
        loading="lazy"
        onLoad={handleLoad}
        onError={handleError}
        className={`${className} transition-opacity duration-300 ${
          status === 'loaded' ? 'opacity-100' : 'absolute h-0 w-0 opacity-0 pointer-events-none'
        }`}
      />
    </div>
  )
}
