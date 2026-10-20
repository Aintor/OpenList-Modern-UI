import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Scan,
  Download,
} from 'lucide-react'

interface ImageViewerProps {
  url: string
  alt: string
  fileName?: string
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ url, alt, fileName }) => {
  const [scale, setScale] = useState<number>(1.0)
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [rotation, setRotation] = useState<number>(0)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [isDockHovered, setIsDockHovered] = useState<boolean>(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
  })

  // Reset transform when url changes
  useEffect(() => {
    setScale(1.0)
    setPosition({ x: 0, y: 0 })
    setRotation(0)
  }, [url])

  // Trackpad pinch-to-zoom and two-finger pan handling
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      // 1. Pinch-to-zoom (ctrlKey or metaKey on macOS)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const zoomDelta = -e.deltaY * 0.005
        setScale((prev) => {
          const next = Math.min(5.0, Math.max(0.2, prev + zoomDelta))
          return Math.round(next * 100) / 100
        })
      } else if (scale > 1.0) {
        // 2. Two-finger trackpad panning when zoomed in
        e.preventDefault()
        setPosition((prev) => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }))
      }
    }

    const handleGestureStart = (e: Event) => {
      e.preventDefault()
    }

    const handleGestureChange = (e: any) => {
      e.preventDefault()
      if (e.scale) {
        setScale((prev) => {
          const factor = e.scale > 1 ? 1.02 : 0.98
          const next = Math.min(5.0, Math.max(0.2, prev * factor))
          return Math.round(next * 100) / 100
        })
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    container.addEventListener('gesturestart', handleGestureStart, { passive: false })
    container.addEventListener('gesturechange', handleGestureChange, { passive: false })

    return () => {
      container.removeEventListener('wheel', handleWheel)
      container.removeEventListener('gesturestart', handleGestureStart)
      container.removeEventListener('gesturechange', handleGestureChange)
    }
  }, [scale])

  // Mouse Drag to Pan
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag on primary mouse button
    if (e.button !== 0) return
    e.preventDefault()
    setIsDragging(true)
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    }
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    const deltaX = e.clientX - dragStartRef.current.startX
    const deltaY = e.clientY - dragStartRef.current.startY
    setPosition({
      x: dragStartRef.current.posX + deltaX,
      y: dragStartRef.current.posY + deltaY,
    })
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    } else {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Double Click: Toggle 1.0x <-> 2.0x zoom
  const handleDoubleClick = () => {
    if (scale > 1.05 || position.x !== 0 || position.y !== 0) {
      setScale(1.0)
      setPosition({ x: 0, y: 0 })
    } else {
      setScale(2.0)
    }
  }

  // Zoom controls
  const handleZoomIn = () => {
    setScale((prev) => Math.min(5.0, Math.round((prev + 0.25) * 100) / 100))
  }

  const handleZoomOut = () => {
    setScale((prev) => {
      const next = Math.max(0.2, Math.round((prev - 0.25) * 100) / 100)
      if (next <= 1.0) {
        setPosition({ x: 0, y: 0 })
      }
      return next
    })
  }

  const handleReset = () => {
    setScale(1.0)
    setPosition({ x: 0, y: 0 })
    setRotation(0)
  }

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360)
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        handleZoomIn()
      } else if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault()
        handleZoomOut()
      } else if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault()
        handleReset()
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        handleRotate()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      className={`relative flex h-[75vh] w-full items-center justify-center overflow-hidden rounded-2xl bg-slate-950 select-none ${
        isDragging
          ? 'cursor-grabbing'
          : scale > 1.05
          ? 'cursor-grab'
          : 'cursor-zoom-in'
      }`}
    >
      {/* Zoomable & Draggable Image Layer */}
      <div
        className={`flex items-center justify-center will-change-transform ${
          isDragging ? 'transition-none' : 'transition-transform duration-150 ease-out'
        }`}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale}) rotate(${rotation}deg)`,
        }}
      >
        <img
          ref={imageRef}
          src={url}
          alt={alt}
          draggable={false}
          className="max-h-[72vh] max-w-full rounded-lg object-contain shadow-2xl pointer-events-none select-none ring-1 ring-white/10"
        />
      </div>

      {/* Floating Frosted Glass Dock */}
      <div
        onMouseEnter={() => setIsDockHovered(true)}
        onMouseLeave={() => setIsDockHovered(false)}
        className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-30 transition-all duration-300 ease-out ${
          isDockHovered ? 'opacity-100 scale-100' : 'opacity-85 hover:opacity-100 scale-100'
        }`}
      >
        <div className="flex items-center gap-3 rounded-full border border-slate-700/60 bg-slate-900/90 hover:border-indigo-500/40 px-4 py-2 text-xs text-slate-200 shadow-2xl backdrop-blur-xl transition-all duration-300">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleZoomOut()
              }}
              disabled={scale <= 0.2}
              title="缩小"
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 hover:bg-indigo-500/15 hover:text-indigo-400 disabled:opacity-30 transition-colors cursor-pointer"
            >
              <ZoomOut className="h-4 w-4" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                handleReset()
              }}
              title="复位"
              className="flex items-center h-7 px-2.5 font-mono text-xs font-semibold text-slate-300 hover:text-indigo-400 hover:bg-indigo-500/15 rounded-lg transition-colors cursor-pointer outline-none"
            >
              <span>{Math.round(scale * 100)}%</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                handleZoomIn()
              }}
              disabled={scale >= 5.0}
              title="放大"
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 hover:bg-indigo-500/15 hover:text-indigo-400 disabled:opacity-30 transition-colors cursor-pointer"
            >
              <ZoomIn className="h-4 w-4" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                handleReset()
              }}
              title="适应窗口"
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 hover:bg-indigo-500/15 hover:text-indigo-400 transition-colors cursor-pointer"
            >
              <Scan className="h-4 w-4" />
            </button>
          </div>

          {/* Divider */}
          <div className="h-4 w-px bg-slate-700/80" />

          {/* Rotate Control */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleRotate()
              }}
              title="旋转"
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 hover:bg-indigo-500/15 hover:text-indigo-400 transition-colors cursor-pointer"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </div>

          {/* Divider */}
          <div className="h-4 w-px bg-slate-700/80" />

          {/* Download Action */}
          <div className="flex items-center gap-1.5">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              download={fileName || alt}
              title="下载"
              onClick={(e) => e.stopPropagation()}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 hover:bg-indigo-500/15 hover:text-indigo-400 transition-colors cursor-pointer"
            >
              <Download className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
