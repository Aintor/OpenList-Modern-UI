import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { Draggable } from 'gsap/Draggable'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  RepeatOff,
  Shuffle,
  Volume2,
  VolumeX,
  ListMusic,
  X,
  Minimize2,
  Disc3,
  Loader2,
  Trash2,
  GripVertical,
} from 'lucide-react'
import { useAudioPlayerStore, RepeatMode } from '~/store/useAudioPlayerStore'
import { Tooltip } from '~/components/ui/Tooltip'
import { useT } from '~/lang'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(Draggable)
}

const formatAudioTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '00:00'
  const min = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}

export const GlobalAudioPlayer: React.FC = () => {
  const t = useT()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const discRef = useRef<HTMLDivElement | null>(null)
  const svgRingRef = useRef<SVGSVGElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const playlistDrawerRef = useRef<HTMLDivElement | null>(null)
  const draggableInstance = useRef<Draggable[] | null>(null)
  
  // Track previous expansion state (pure state diff, no isFirstRender needed)
  const prevExpandedRef = useRef(false)

  const [isVolumeOpen, setIsVolumeOpen] = useState(false)
  const volumeCapsuleRef = useRef<HTMLDivElement | null>(null)
  const volumeSliderWrapperRef = useRef<HTMLDivElement | null>(null)
  const isVolumeFirstRender = useRef(true)
  const volumeTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [isScrubbing, setIsScrubbing] = useState(false)
  const [scrubValue, setScrubValue] = useState(0)

  const handleVolumeMouseEnter = () => {
    if (volumeTimerRef.current) {
      clearTimeout(volumeTimerRef.current)
      volumeTimerRef.current = null
    }
  }

  const handleVolumeMouseLeave = () => {
    if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current)
    volumeTimerRef.current = setTimeout(() => {
      setIsVolumeOpen(false)
    }, 350)
  }

  // Click outside to collapse volume slider as fallback
  useEffect(() => {
    if (!isVolumeOpen) return

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (volumeCapsuleRef.current && !volumeCapsuleRef.current.contains(e.target as Node)) {
        setIsVolumeOpen(false)
      }
    }

    window.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('touchstart', handleClickOutside)
    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isVolumeOpen])
  
  // Vertical displacement drag state
  const [dragState, setDragState] = useState<{
    startIndex: number
    deltaY: number
    targetIndex: number
    itemHeight: number
  } | null>(null)
  const itemElementsRef = useRef<(HTMLDivElement | null)[]>([])

  const {
    activeTrack,
    playlist,
    currentIndex,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    repeatMode,
    isExpanded,
    isPlaylistOpen,
    loading,
    togglePlay,
    pause,
    resume,
    seekTo,
    nextTrack,
    prevTrack,
    removeTrack,
    moveTrack,
    clearPlaylist,
    setVolume,
    toggleMute,
    setRepeatMode,
    togglePlaylist,
    setExpanded,
    closePlayer,
    updateTime,
    playTrack,
  } = useAudioPlayerStore()

  // Vertical displacement drag reorder handler with edge rubber-band damping
  const handleGripPointerDown = (e: React.PointerEvent, startIndex: number) => {
    e.preventDefault()
    e.stopPropagation()

    const startY = e.clientY
    const currentEl = itemElementsRef.current[startIndex]
    const itemHeight = currentEl ? currentEl.offsetHeight + 2 : 36

    setDragState({
      startIndex,
      deltaY: 0,
      targetIndex: startIndex,
      itemHeight,
    })

    let lastTargetIndex = startIndex

    const onPointerMove = (moveEvt: PointerEvent) => {
      moveEvt.preventDefault()
      const rawDeltaY = moveEvt.clientY - startY
      const offsetSlots = Math.round(rawDeltaY / itemHeight)
      const targetIndex = Math.max(0, Math.min(playlist.length - 1, startIndex + offsetSlots))

      // Edge rubber-band damping calculation
      const minDeltaY = -startIndex * itemHeight
      const maxDeltaY = (playlist.length - 1 - startIndex) * itemHeight

      let dampedDeltaY = rawDeltaY
      if (rawDeltaY < minDeltaY) {
        const overflow = minDeltaY - rawDeltaY
        dampedDeltaY = minDeltaY - 8 * Math.tanh(overflow / 25)
      } else if (rawDeltaY > maxDeltaY) {
        const overflow = rawDeltaY - maxDeltaY
        dampedDeltaY = maxDeltaY + 8 * Math.tanh(overflow / 25)
      }

      lastTargetIndex = targetIndex
      setDragState({
        startIndex,
        deltaY: dampedDeltaY,
        targetIndex,
        itemHeight,
      })
    }

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)

      if (lastTargetIndex !== startIndex) {
        moveTrack(startIndex, lastTargetIndex)
      }
      setDragState(null)
    }

    window.addEventListener('pointermove', onPointerMove, { passive: false })
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
  }

  // Initialize GSAP Draggable with window bounds & explicit trigger on card
  useEffect(() => {
    if (!activeTrack || !containerRef.current || !cardRef.current) return

    draggableInstance.current = Draggable.create(containerRef.current, {
      trigger: cardRef.current,
      type: 'x,y',
      bounds: window,
      edgeResistance: 0.75,
      dragClickables: false,
      zIndexBoost: false,
      allowContextMenu: true,
      cursor: 'grab',
      activeCursor: 'grabbing',
      cancel: 'input, button, select, textarea, [data-no-drag]',
    })

    return () => {
      if (draggableInstance.current) {
        draggableInstance.current.forEach((d) => d.kill())
        draggableInstance.current = null
      }
    }
  }, [activeTrack])

  // Pure State-Diff Morphing Animation (With Auto Viewport Edge Clamping)
  useLayoutEffect(() => {
    // If state hasn't changed (e.g. initial mount where prev=false and current=false), do nothing
    if (prevExpandedRef.current === isExpanded) return
    prevExpandedRef.current = isExpanded

    if (!cardRef.current || !discRef.current || !contentRef.current || !containerRef.current) return

    const container = containerRef.current
    const card = cardRef.current
    const disc = discRef.current
    const content = contentRef.current
    const svgRing = svgRingRef.current

    gsap.killTweensOf([container, card, disc, content, svgRing])

    if (isExpanded) {
      // 1. Calculate Edge Overflow Bounds (Accounting for left & bottom CSS anchors)
      const rect = container.getBoundingClientRect()
      const margin = 16
      const targetWidth = 384
      const targetHeight = 160

      let deltaX = 0
      let deltaY = 0

      // Horizontal (Anchored to Left, expands to the right)
      const futureRight = rect.left + targetWidth
      const futureLeft = rect.left
      if (futureRight > window.innerWidth - margin) {
        deltaX = (window.innerWidth - margin) - futureRight
      } else if (futureLeft < margin) {
        deltaX = margin - futureLeft
      }

      // Vertical (Anchored to Bottom-6, expands UPWARDS to the top)
      const futureTop = rect.bottom - targetHeight
      const futureBottom = rect.bottom
      if (futureTop < margin) {
        deltaY = margin - futureTop
      } else if (futureBottom > window.innerHeight - margin) {
        deltaY = (window.innerHeight - margin) - futureBottom
      }

      const tl = gsap.timeline({
        defaults: { ease: 'power3.out' },
        onComplete: () => {
          gsap.set(card, { overflow: 'visible' })
          draggableInstance.current?.[0]?.update()
        },
      })

      // 2. Smoothly shift container into viewport if needed
      if (deltaX !== 0 || deltaY !== 0) {
        tl.to(container, {
          x: `+=${deltaX}`,
          y: `+=${deltaY}`,
          duration: 0.4,
        }, 0)
      }

      // 3. Outer container smoothly expands
      tl.fromTo(card, { width: 52, height: 52, borderRadius: 26 }, { width: 384, height: 160, borderRadius: 24, duration: 0.4 }, 0)
      // 4. Vinyl disc smoothly glides to top-left corner
      tl.fromTo(disc, { x: 0, y: 0, scale: 1 }, { x: 10, y: 8, scale: 0.9, duration: 0.4 }, 0)
      if (svgRing) tl.to(svgRing, { opacity: 0, duration: 0.14 }, 0)
      // 5. Expanded content fades in
      tl.set(content, { display: 'flex' }, 0.05)
      tl.fromTo(content, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.28, ease: 'power2.out' }, 0.12)
    } else {
      gsap.set(card, { overflow: 'hidden' })
      const tl = gsap.timeline({
        defaults: { ease: 'power3.out' },
        onComplete: () => {
          draggableInstance.current?.[0]?.update()
        },
      })
      // 1. Expanded content fades out
      tl.to(content, {
        opacity: 0,
        y: 4,
        duration: 0.12,
        ease: 'power2.in',
        onComplete: () => {
          gsap.set(content, { display: 'none' })
        },
      }, 0)
      // 2. Outer container smoothly contracts back to 52px circle
      tl.fromTo(card, { width: 384, height: 160, borderRadius: 24 }, { width: 52, height: 52, borderRadius: 26, duration: 0.36 }, 0.04)
      // 3. Vinyl disc smoothly glides back to center
      tl.fromTo(disc, { x: 10, y: 8, scale: 0.9 }, { x: 0, y: 0, scale: 1, duration: 0.36 }, 0.04)
      if (svgRing) tl.to(svgRing, { opacity: 1, duration: 0.2 }, 0.12)
    }
  }, [isExpanded])

  // GSAP Playlist Drawer Flyout Animation
  useLayoutEffect(() => {
    if (!playlistDrawerRef.current) return
    const drawer = playlistDrawerRef.current

    if (isPlaylistOpen && isExpanded) {
      gsap.fromTo(
        drawer,
        { opacity: 0, y: 15, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.25, ease: 'power3.out', display: 'flex' }
      )
    } else {
      gsap.to(drawer, {
        opacity: 0,
        y: 10,
        scale: 0.96,
        duration: 0.18,
        ease: 'power2.in',
        onComplete: () => {
          drawer.style.display = 'none'
        },
      })
    }
  }, [isPlaylistOpen, isExpanded])

  // GSAP Volume Overlay Capsule Extension Animation
  useLayoutEffect(() => {
    const capsule = volumeCapsuleRef.current
    const sliderWrapper = volumeSliderWrapperRef.current
    if (!capsule || !sliderWrapper) return

    if (isVolumeFirstRender.current) {
      isVolumeFirstRender.current = false
      if (!isVolumeOpen) {
        gsap.set(capsule, { display: 'none', opacity: 0, width: 36 })
      }
      return
    }

    gsap.killTweensOf([capsule, sliderWrapper])

    if (isVolumeOpen) {
      // Reveal capsule and expand width from right to left (over the playlist button)
      gsap.set(capsule, { display: 'flex' })
      gsap.fromTo(
        capsule,
        { width: 36, opacity: 0 },
        { width: 116, opacity: 1, duration: 0.24, ease: 'power2.out' }
      )
      gsap.fromTo(
        sliderWrapper,
        { opacity: 0, x: 8 },
        { opacity: 1, x: 0, duration: 0.2, ease: 'power2.out', delay: 0.05 }
      )
    } else {
      // Collapse capsule back towards right
      gsap.to(sliderWrapper, {
        opacity: 0,
        x: 8,
        duration: 0.14,
        ease: 'power2.in',
      })
      gsap.to(capsule, {
        width: 36,
        opacity: 0,
        duration: 0.18,
        ease: 'power2.in',
        onComplete: () => {
          gsap.set(capsule, { display: 'none' })
        },
      })
    }
  }, [isVolumeOpen])

  // Sync audio play/pause
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }, [isPlaying, activeTrack?.rawUrl])

  // Sync volume & muted
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = isMuted ? 0 : volume
  }, [volume, isMuted])

  // MediaSession API integration
  useEffect(() => {
    if (!activeTrack || !('mediaSession' in navigator)) return

    navigator.mediaSession.metadata = new MediaMetadata({
      title: activeTrack.obj.name,
      artist: 'OpenList Audio',
      album: activeTrack.path,
    })

    navigator.mediaSession.setActionHandler('play', () => resume())
    navigator.mediaSession.setActionHandler('pause', () => pause())
    navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack())
    navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack())
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined && audioRef.current) {
        audioRef.current.currentTime = details.seekTime
        seekTo(details.seekTime)
      }
    })

    return () => {
      try {
        navigator.mediaSession.setActionHandler('play', null)
        navigator.mediaSession.setActionHandler('pause', null)
        navigator.mediaSession.setActionHandler('previoustrack', null)
        navigator.mediaSession.setActionHandler('nexttrack', null)
        navigator.mediaSession.setActionHandler('seekto', null)
      } catch (e) {}
    }
  }, [activeTrack])

  if (!activeTrack) return null

  const handleTimeUpdate = () => {
    if (!audioRef.current || isScrubbing) return
    updateTime(audioRef.current.currentTime, audioRef.current.duration)
  }

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return
    updateTime(audioRef.current.currentTime, audioRef.current.duration)
  }

  const handleEnded = () => {
    if (repeatMode === 'one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0
        audioRef.current.play()
      }
    } else if (repeatMode === 'off') {
      // Repeat Off: Stop playback when reaching the end of the playlist
      if (currentIndex >= playlist.length - 1) {
        pause()
      } else {
        nextTrack()
      }
    } else {
      nextTrack()
    }
  }

  const handleScrubChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setScrubValue(val)
    if (!isScrubbing) setIsScrubbing(true)
  }

  const handleScrubCommit = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = scrubValue
      seekTo(scrubValue)
    }
    setIsScrubbing(false)
  }

  const handleCycleRepeatMode = () => {
    const modes: RepeatMode[] = ['list', 'one', 'shuffle', 'off']
    const nextMode = modes[(modes.indexOf(repeatMode) + 1) % modes.length]
    setRepeatMode(nextMode)
  }

  // Circular progress calculations (Radius = 22, circumference = 2 * PI * 22 ~= 138.23)
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const progressRatio = duration > 0 ? currentTime / duration : 0
  const strokeDashoffset = circumference * (1 - progressRatio)

  return (
    <>
      {/* Hidden Native Audio Element */}
      <audio
        ref={audioRef}
        src={activeTrack.rawUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        autoPlay
      />

      {/* Main Draggable Anchor Container */}
      <div
        ref={containerRef}
        className="fixed bottom-6 left-6 z-40 select-none touch-none pointer-events-auto"
      >
        {/* Playlist Flyout Drawer */}
        <div
          ref={playlistDrawerRef}
          style={{ display: 'none' }}
          data-no-drag="true"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="playlist-drawer absolute bottom-full mb-3 left-0 w-80 sm:w-96 max-h-80 flex flex-col rounded-3xl border border-white/10 bg-slate-900/95 text-slate-100 shadow-2xl shadow-black/60 backdrop-blur-2xl overflow-hidden pointer-events-auto z-10"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 bg-white/5">
            <div className="flex items-center space-x-2">
              <ListMusic className="h-4 w-4 text-indigo-400" />
              <span className="text-xs font-bold text-white">
                {t('home.player.playlist') || '播放列表'}
              </span>
            </div>

            <div className="flex items-center space-x-1">
              <Tooltip content={t('home.player.clear_playlist') || '清空列表'} side="top">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    clearPlaylist()
                  }}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </Tooltip>

              <button
                type="button"
                onClick={() => togglePlaylist(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 max-h-64">
            {playlist.map((track, idx) => {
              const isCurrent = idx === currentIndex
              const isDraggingThis = dragState?.startIndex === idx

              let translateY = 0
              if (dragState) {
                if (isDraggingThis) {
                  translateY = dragState.deltaY
                } else {
                  const { startIndex, targetIndex, itemHeight } = dragState
                  if (targetIndex > startIndex) {
                    // 往下拖：位于 (startIndex, targetIndex] 区间的项目向上平移让位
                    if (idx > startIndex && idx <= targetIndex) {
                      translateY = -itemHeight
                    }
                  } else if (targetIndex < startIndex) {
                    // 往上拖：位于 [targetIndex, startIndex) 区间的项目向下平移让位
                    if (idx >= targetIndex && idx < startIndex) {
                      translateY = itemHeight
                    }
                  }
                }
              }

              return (
                <div
                  key={`${track.path}/${track.obj.name}`}
                  ref={(el) => {
                    itemElementsRef.current[idx] = el
                  }}
                  style={{
                    transform: `translateY(${translateY}px)`,
                    transition: isDraggingThis ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)',
                    zIndex: isDraggingThis ? 30 : 1,
                  }}
                  onClick={() => {
                    if (!dragState) {
                      playTrack(track.obj, track.path, playlist.map((p) => p.obj))
                    }
                  }}
                  className={`group relative flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs select-none cursor-pointer ${
                    isDraggingThis
                      ? 'bg-slate-800 ring-1 ring-indigo-400/80 shadow-2xl shadow-black/80 text-white scale-[1.02]'
                      : isCurrent
                      ? 'bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/30'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {/* Dedicated Drag Grip Handle (Pure Vertical Pointer Reordering) */}
                    <div
                      onPointerDown={(e) => handleGripPointerDown(e, idx)}
                      className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-indigo-300 p-0.5 rounded transition-colors shrink-0 touch-none"
                      title="按住上下滑动排序"
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </div>

                    {isCurrent && (
                      <div className="flex items-end space-x-0.5 h-3.5 w-3 shrink-0 pb-0.5">
                        {isPlaying ? (
                          <>
                            <span className="w-0.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s] h-full"></span>
                            <span className="w-0.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s] h-2/3"></span>
                            <span className="w-0.5 bg-indigo-400 rounded-full animate-bounce h-4/5"></span>
                          </>
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 m-auto"></span>
                        )}
                      </div>
                    )}

                    <span title={track.obj.name} className="truncate block min-w-0 flex-1">
                      {track.obj.name}
                    </span>
                  </div>

                  {/* Remove Track Button on hover (Hidden during drag) */}
                  {!dragState && (
                    <Tooltip content={t('home.player.remove_from_playlist') || '从列表中移除'} side="top">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeTrack(idx)
                        }}
                        className="opacity-0 group-hover:opacity-100 rounded p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer shrink-0 ml-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </Tooltip>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Single Physical Morphing Card */}
        <div
          ref={cardRef}
          onClick={() => {
            if (!isExpanded) setExpanded(true)
          }}
          className={`relative z-20 border border-white/12 bg-slate-900/95 text-white shadow-2xl shadow-black/60 backdrop-blur-2xl ${
            isExpanded ? 'overflow-visible' : 'overflow-hidden'
          } ${
            !isExpanded ? 'cursor-pointer hover:scale-105 active:scale-95 transition-transform' : ''
          }`}
          style={{ width: 52, height: 52, borderRadius: 26 }}
        >
          {/* Continuous Shared Rotating Vinyl Disc (Glides from center to top-left corner) */}
          <div
            ref={discRef}
            className="absolute top-1.5 left-1.5 h-10 w-10 flex items-center justify-center pointer-events-none rounded-full z-20"
          >
            {/* Circular Progress Ring (Visible in collapsed mode) */}
            <svg
              ref={svgRingRef}
              className="absolute inset-0 h-full w-full -rotate-90 pointer-events-none"
              viewBox="0 0 48 48"
            >
              <circle
                cx="24"
                cy="24"
                r={radius}
                fill="none"
                stroke="rgba(255, 255, 255, 0.12)"
                strokeWidth="2.5"
              />
              <circle
                cx="24"
                cy="24"
                r={radius}
                fill="none"
                stroke="#6366f1"
                strokeWidth="2.5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-200"
              />
            </svg>

            {/* Rotating Disc / Album Icon (Perfect Concentric Circle with distinct dynamic border) */}
            <div
              className={`relative flex h-8.5 w-8.5 items-center justify-center rounded-full bg-slate-950/90 border-2 transition-colors duration-300 shadow-inner ${
                isPlaying
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-white/20 text-slate-400'
              }`}
            >
              {loading ? (
                <Loader2 className="h-4.5 w-4.5 animate-spin text-indigo-400" />
              ) : (
                <Disc3
                  className="h-5 w-5 animate-spin transition-opacity"
                  style={{
                    animationDuration: '4s',
                    animationPlayState: isPlaying ? 'running' : 'paused',
                    opacity: isPlaying ? 1 : 0.65,
                  }}
                />
              )}
            </div>
          </div>

          {/* Expanded Content Layer (Positioned at absolute inset-0) */}
          <div
            ref={contentRef}
            className="absolute inset-0 p-3.5 flex flex-col justify-between"
            style={{ display: 'none' }}
          >
            {/* Header row: Title (with left padding to avoid disc) + Minimize/Close buttons */}
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1 pl-12 pr-3">
                <h4
                  title={activeTrack.obj.name}
                  className="truncate text-xs font-bold text-white leading-tight"
                >
                  {activeTrack.obj.name}
                </h4>
              </div>

              <div className="flex items-center space-x-1 shrink-0">
                <Tooltip content={t('home.player.close') || '关闭播放器'} side="top">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      closePlayer()
                    }}
                    className="rounded-lg p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </Tooltip>
              </div>
            </div>

            {/* Progress Slider row with time at both ends */}
            <div className="flex items-center space-x-2.5">
              <span className="font-mono text-[10px] text-slate-400 tabular-nums select-none shrink-0 w-8 text-left">
                {formatAudioTime(isScrubbing ? scrubValue : currentTime)}
              </span>

              <div className="flex-1 flex items-center">
                {(() => {
                  const progressPercent = duration ? ((isScrubbing ? scrubValue : currentTime) / duration) * 100 : 0
                  return (
                    <input
                      type="range"
                      min="0"
                      max={duration || 100}
                      step="0.1"
                      value={isScrubbing ? scrubValue : currentTime}
                      onChange={handleScrubChange}
                      onMouseUp={handleScrubCommit}
                      onTouchEnd={handleScrubCommit}
                      style={{
                        background: `linear-gradient(to right, var(--color-indigo-500, #6366f1) 0%, var(--color-indigo-500, #6366f1) ${progressPercent}%, rgba(255, 255, 255, 0.18) ${progressPercent}%, rgba(255, 255, 255, 0.18) 100%)`,
                      }}
                      className="audio-mini-slider w-full"
                    />
                  )
                })()}
              </div>

              <span className="font-mono text-[10px] text-slate-400 tabular-nums select-none shrink-0 w-8 text-right">
                {formatAudioTime(duration)}
              </span>
            </div>

            {/* Symmetrical 3-Column Control Bar (100% Center Alignment) */}
            <div className="grid grid-cols-3 items-center">
              {/* Left: Minimize & Repeat Mode in Bottom-Left */}
              <div className="flex items-center justify-start space-x-0.5">
                <Tooltip content={t('home.player.minimize') || '收起为黑胶胶囊'} side="top">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setExpanded(false)
                      togglePlaylist(false)
                    }}
                    className="rounded-xl p-2 text-slate-400 hover:text-white hover:bg-white/10 active:scale-95 transition-colors cursor-pointer"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </button>
                </Tooltip>

                <Tooltip
                  content={
                    repeatMode === 'off'
                      ? (t('home.player.repeat_off') || '停止循环')
                      : repeatMode === 'list'
                      ? (t('home.player.list_repeat') || '列表循环')
                      : repeatMode === 'one'
                      ? (t('home.player.one_repeat') || '单曲循环')
                      : (t('home.player.shuffle') || '随机播放')
                  }
                  side="top"
                >
                  <button
                    type="button"
                    onClick={handleCycleRepeatMode}
                    className={`rounded-xl p-2 transition-colors cursor-pointer ${
                      repeatMode !== 'off'
                        ? 'text-indigo-400 bg-indigo-950/60'
                        : 'text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {repeatMode === 'off' ? (
                      <RepeatOff className="h-4 w-4" />
                    ) : repeatMode === 'list' ? (
                      <Repeat className="h-4 w-4" />
                    ) : repeatMode === 'one' ? (
                      <Repeat1 className="h-4 w-4" />
                    ) : (
                      <Shuffle className="h-4 w-4" />
                    )}
                  </button>
                </Tooltip>
              </div>

              {/* Center: Prev / Pure Solid Play / Next */}
              <div className="flex items-center justify-center space-x-2">
                <button
                  type="button"
                  onClick={prevTrack}
                  disabled={playlist.length <= 1}
                  className="rounded-xl p-2 text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 disabled:opacity-30 transition-all cursor-pointer"
                >
                  <SkipBack className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={togglePlay}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  {isPlaying ? (
                    <Pause className="h-4.5 w-4.5 fill-current" />
                  ) : (
                    <Play className="h-4.5 w-4.5 fill-current ml-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={nextTrack}
                  disabled={playlist.length <= 1}
                  className="rounded-xl p-2 text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 disabled:opacity-30 transition-all cursor-pointer"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
              </div>

              {/* Right: Volume & Playlist */}
              <div className="relative flex items-center justify-end space-x-1 h-10 select-none">
                {/* Underlying Layer: Playlist Button (100% physically fixed, never displaced or hidden) */}
                <Tooltip content={t('home.player.playlist') || '播放列表'} side="top">
                  <button
                    type="button"
                    onClick={() => togglePlaylist()}
                    className={`relative flex items-center space-x-1 rounded-xl p-2 transition-colors cursor-pointer shrink-0 ${
                      isPlaylistOpen
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <ListMusic className="h-4 w-4" />
                    {playlist.length > 0 && (
                      <span className="font-mono text-[10px] font-bold">
                        {currentIndex + 1}/{playlist.length}
                      </span>
                    )}
                  </button>
                </Tooltip>

                {/* Underlying Layer: Volume Icon Button (Click to trigger overlay capsule) */}
                <Tooltip content={t('home.player.volume') || '音量'} side="top">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsVolumeOpen(true)
                    }}
                    className="rounded-xl p-2 text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="h-4 w-4 text-rose-400" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </button>
                </Tooltip>

                {/* Floating Overlay Layer: Frosted Capsule (Directly covers underlying buttons from right to left) */}
                <div
                  ref={volumeCapsuleRef}
                  style={{ display: 'none', width: 36, opacity: 0 }}
                  onMouseEnter={handleVolumeMouseEnter}
                  onMouseLeave={handleVolumeMouseLeave}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-30 flex items-center justify-end bg-slate-900/95 border border-white/20 rounded-full pl-3.5 pr-1.5 py-1 shadow-2xl shadow-black/80 backdrop-blur-2xl overflow-hidden"
                >
                  {/* Slider Wrapper */}
                  <div
                    ref={volumeSliderWrapperRef}
                    className="flex items-center pr-2 shrink-0"
                  >
                    {(() => {
                      const volumePercent = isMuted ? 0 : Math.round(volume * 100)
                      return (
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={isMuted ? 0 : volume}
                          onChange={(e) => {
                            if (isMuted) toggleMute()
                            setVolume(parseFloat(e.target.value))
                          }}
                          style={{
                            background: `linear-gradient(to right, var(--color-indigo-500, #6366f1) 0%, var(--color-indigo-500, #6366f1) ${volumePercent}%, rgba(255, 255, 255, 0.18) ${volumePercent}%, rgba(255, 255, 255, 0.18) 100%)`,
                          }}
                          className="audio-mini-slider w-15"
                        />
                      )
                    })()}
                  </div>

                  {/* Volume Icon Button inside Capsule (Click to Toggle Mute) */}
                  <Tooltip
                    content={isMuted ? t('home.player.unmute') || '取消静音' : t('home.player.mute') || '静音'}
                    side="top"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleMute()
                      }}
                      className={`p-1.5 rounded-full transition-colors cursor-pointer shrink-0 ${
                        isMuted || volume === 0
                          ? 'text-rose-400 hover:text-rose-300 hover:bg-rose-500/10'
                          : 'text-indigo-300 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </button>
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
