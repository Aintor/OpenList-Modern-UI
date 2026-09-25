import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  RepeatOff,
  Shuffle,
  ListMusic,
  X,
} from 'lucide-react'
import { useAudioPlayerStore, RepeatMode } from '~/store/useAudioPlayerStore'
import { useT } from '~/lang'
import { AudioMetadata } from '~/utils/audioMeta'
import { PlaylistContent } from '~/components/player/PlaylistContent'
import { VinylRecord } from '~/components/player/VinylRecord'
import { MarqueeText } from '~/components/player/MarqueeText'
import {
  MobilePlayerMode,
  MobilePlayerElements,
  applyModeGeometryInstant,
  runModeTransition,
  interpolateModeProgress,
} from '~/components/player/mobilePlayerGeometry'

const formatAudioTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '00:00'
  const min = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}

interface MobileAudioPlayerProps {
  metadata: AudioMetadata
  onSeek: (time: number) => void
}

export const MobileAudioPlayer: React.FC<MobileAudioPlayerProps> = ({
  metadata,
  onSeek,
}) => {
  const t = useT()
  const mobileCardRef = useRef<HTMLDivElement | null>(null)
  const mobileDiscRef = useRef<HTMLDivElement | null>(null)
  const mobileControlsRef = useRef<HTMLDivElement | null>(null)
  const mobileTitleRef = useRef<HTMLDivElement | null>(null)
  const mobileTopTitleRef = useRef<HTMLDivElement | null>(null)
  const mobileHeaderRef = useRef<HTMLDivElement | null>(null)
  const mobileScrubberRef = useRef<HTMLDivElement | null>(null)
  const mobileSideControlsRef = useRef<HTMLDivElement | null>(null)
  const mobileBackdropRef = useRef<HTMLDivElement | null>(null)
  const mobileProgressHairlineRef = useRef<HTMLDivElement | null>(null)
  const mobilePlaylistViewRef = useRef<HTMLDivElement | null>(null)

  const currentMobileModeRef = useRef<MobilePlayerMode>('collapsed')
  const mobileTouchStartY = useRef(0)
  const mobileCurrentDragY = useRef(0)
  const isMobileDraggingRef = useRef(false)
  const isTransitioningRef = useRef(false)

  const [isScrubbing, setIsScrubbing] = useState(false)
  const [scrubValue, setScrubValue] = useState(0)
  const [isConfirmingClose, setIsConfirmingClose] = useState(false)
  const confirmCloseTimerRef = useRef<NodeJS.Timeout | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const closeTextRef = useRef<HTMLSpanElement | null>(null)
  const isConfirmingCloseFirstRender = useRef(true)

  const {
    activeTrack,
    playlist,
    isPlaying,
    currentTime,
    duration,
    repeatMode,
    isExpanded,
    isPlaylistOpen,
    loading,
    togglePlay,
    nextTrack,
    prevTrack,
    setRepeatMode,
    togglePlaylist,
    setExpanded,
    closePlayer,
  } = useAudioPlayerStore()

  const targetMobileMode: MobilePlayerMode = !isExpanded
    ? 'collapsed'
    : isPlaylistOpen
    ? 'queue'
    : 'expanded'

  const getMobileElements = (): MobilePlayerElements => ({
    card: mobileCardRef.current,
    disc: mobileDiscRef.current,
    controls: mobileControlsRef.current,
    title: mobileTitleRef.current,
    topTitle: mobileTopTitleRef.current,
    header: mobileHeaderRef.current,
    scrubber: mobileScrubberRef.current,
    sideControls: mobileSideControlsRef.current,
    backdrop: mobileBackdropRef.current,
    hairline: mobileProgressHairlineRef.current,
    playlistView: mobilePlaylistViewRef.current,
  })

  // Lock body scroll on mobile viewport when expanded/queue to prevent touch penetration
  useEffect(() => {
    if (typeof window === 'undefined') return
    const isMobileViewport = window.innerWidth < 768
    if (isExpanded && isMobileViewport) {
      const originalOverflow = document.body.style.overflow
      const originalTouchAction = document.body.style.touchAction
      document.body.style.overflow = 'hidden'
      document.body.style.touchAction = 'none'

      return () => {
        document.body.style.overflow = originalOverflow
        document.body.style.touchAction = originalTouchAction
      }
    }
  }, [isExpanded])

  // Single unified Mode Transition Engine
  useLayoutEffect(() => {
    const prevMode = currentMobileModeRef.current
    if (prevMode === targetMobileMode) return
    currentMobileModeRef.current = targetMobileMode

    const elements = getMobileElements()

    isTransitioningRef.current = true
    runModeTransition(prevMode, targetMobileMode, elements, () => {
      isTransitioningRef.current = false
    })
  }, [targetMobileMode])

  // Set initial placement on mount
  useLayoutEffect(() => {
    applyModeGeometryInstant(getMobileElements(), targetMobileMode)
  }, [])

  // Reset confirmation state when unmounting or when collapsed
  useEffect(() => {
    if (!isExpanded) {
      setIsConfirmingClose(false)
      if (confirmCloseTimerRef.current) clearTimeout(confirmCloseTimerRef.current)
    }
  }, [isExpanded])

  useEffect(() => {
    return () => {
      if (confirmCloseTimerRef.current) clearTimeout(confirmCloseTimerRef.current)
    }
  }, [])

  // GSAP Animation for Confirmation Close Capsule
  useLayoutEffect(() => {
    const btn = closeBtnRef.current
    const txt = closeTextRef.current
    if (!btn || !txt) return

    if (isConfirmingCloseFirstRender.current) {
      isConfirmingCloseFirstRender.current = false
      if (!isConfirmingClose) {
        gsap.set(btn, { width: 28, borderRadius: 12 })
        gsap.set(txt, { opacity: 0, display: 'none', x: -6 })
      }
      return
    }

    gsap.killTweensOf([btn, txt])

    if (isConfirmingClose) {
      gsap.set(txt, { display: 'block' })
      gsap.to(btn, {
        width: 86,
        borderRadius: 9999,
        duration: 0.28,
        ease: 'power3.out',
      })
      gsap.fromTo(
        txt,
        { opacity: 0, x: -6 },
        { opacity: 1, x: 0, duration: 0.22, delay: 0.04, ease: 'power2.out' }
      )
    } else {
      gsap.to(txt, {
        opacity: 0,
        x: -6,
        duration: 0.15,
        ease: 'power2.in',
        onComplete: () => {
          gsap.set(txt, { display: 'none' })
        },
      })
      gsap.to(btn, {
        width: 28,
        borderRadius: 12,
        duration: 0.24,
        ease: 'power3.inOut',
      })
    }
  }, [isConfirmingClose])

  if (!activeTrack) return null

  const handleMobileClose = () => {
    if (isPlaylistOpen) togglePlaylist(false)
    setExpanded(false)
  }

  const handleCloseClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isConfirmingClose) {
      if (confirmCloseTimerRef.current) clearTimeout(confirmCloseTimerRef.current)
      setIsConfirmingClose(false)
      closePlayer()
    } else {
      setIsConfirmingClose(true)
      if (confirmCloseTimerRef.current) clearTimeout(confirmCloseTimerRef.current)
      confirmCloseTimerRef.current = setTimeout(() => {
        setIsConfirmingClose(false)
      }, 3000)
    }
  }

  // Mobile Interactive Touch Drag Handlers (1:1 跟手拖拽)
  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation()
    if (isConfirmingClose) {
      setIsConfirmingClose(false)
      if (confirmCloseTimerRef.current) clearTimeout(confirmCloseTimerRef.current)
    }
    mobileTouchStartY.current = e.touches[0].clientY
    mobileCurrentDragY.current = 0
    isMobileDraggingRef.current = true
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobileDraggingRef.current) return
    e.preventDefault()
    e.stopPropagation()
    const deltaY = e.touches[0].clientY - mobileTouchStartY.current
    if (deltaY > 0) {
      mobileCurrentDragY.current = deltaY
      const progress = Math.min(1, Math.max(0, deltaY / 240))
      const fromMode = currentMobileModeRef.current === 'queue' ? 'queue' : 'expanded'
      const cardWidth = mobileCardRef.current?.clientWidth || 360
      interpolateModeProgress(fromMode, progress, getMobileElements(), cardWidth)
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isMobileDraggingRef.current) return
    e.stopPropagation()
    isMobileDraggingRef.current = false
    const deltaY = mobileCurrentDragY.current

    if (deltaY > 60) {
      if (isPlaylistOpen) togglePlaylist(false)
      setExpanded(false)
    } else {
      const fromMode = currentMobileModeRef.current === 'queue' ? 'queue' : 'expanded'
      runModeTransition('collapsed', fromMode, getMobileElements())
    }
  }

  const handleCycleRepeatMode = (e: React.MouseEvent) => {
    e.stopPropagation()
    const modes: RepeatMode[] = ['off', 'list', 'one', 'shuffle']
    const nextIdx = (modes.indexOf(repeatMode) + 1) % modes.length
    setRepeatMode(modes[nextIdx])
  }

  const handleScrubChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setIsScrubbing(true)
    setScrubValue(val)
  }

  const handleScrubCommit = () => {
    if (isScrubbing) {
      setIsScrubbing(false)
      onSeek(scrubValue)
    }
  }

  const displayTitle = metadata.title || activeTrack.obj.name
  const displayArtist = metadata.artist

  return (
    <div className="block md:hidden">
      {/* Backdrop */}
      <div
        ref={mobileBackdropRef}
        onClick={handleMobileClose}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onTouchEnd={(e) => e.stopPropagation()}
        style={{ opacity: 0, pointerEvents: 'none' }}
        className="fixed inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-xs z-30 transition-opacity touch-none select-none overscroll-none"
      />

      {/* Mobile Morphing Card */}
      <div
        ref={mobileCardRef}
        onClick={(e) => {
          e.stopPropagation()
          if (!isExpanded) setExpanded(true)
        }}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => {
          if (!isPlaylistOpen) {
            e.stopPropagation()
          }
        }}
        onTouchEnd={(e) => e.stopPropagation()}
        style={{ height: 56, borderRadius: 20 }}
        className={`fixed bottom-4 inset-x-3.5 z-40 border border-slate-200/80 bg-white/95 text-slate-800 shadow-2xl backdrop-blur-2xl overflow-hidden select-none overscroll-contain dark:border-white/15 dark:bg-slate-900/95 dark:text-white ${
          !isExpanded ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''
        }`}
      >
        {/* Collapsed progress hairline */}
        <div
          ref={mobileProgressHairlineRef}
          className="absolute bottom-0 inset-x-0 h-0.5 bg-slate-200/80 dark:bg-white/10 z-30 pointer-events-none"
        >
          <div
            className="h-full bg-indigo-500 transition-all duration-200"
            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />
        </div>

        {/* Rotating Vinyl Disc */}
        <div
          ref={mobileDiscRef}
          style={{
            width: 150,
            height: 150,
            top: 9,
            left: 10,
            transformOrigin: 'top left',
            transform: 'scale(0.253333)',
          }}
          className="absolute flex items-center justify-center rounded-full pointer-events-none z-30"
        >
          <VinylRecord
            size={150}
            coverUrl={metadata.coverUrl}
            isPlaying={isPlaying}
            loading={loading}
            duration={duration}
            alt={activeTrack.obj.name}
            className="h-full w-full"
          />
        </div>

        {/* Title & Artist */}
        <div
          ref={mobileTitleRef}
          style={{
            top: 9,
            left: 54,
            right: 128,
            height: 38,
          }}
          className="absolute z-20 pointer-events-none flex flex-col justify-center gap-0.5 px-1 overflow-hidden"
        >
          <MarqueeText
            text={displayTitle}
            className="text-xs font-bold text-slate-900 dark:text-white leading-tight"
            align="center"
          />
          {displayArtist && (
            <MarqueeText
              text={displayArtist}
              className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight"
              align="center"
            />
          )}
        </div>

        {/* Top Mini Track Title (Playlist Mode, floats in from below) */}
        <div
          ref={mobileTopTitleRef}
          style={{ display: 'none', opacity: 0 }}
          className="absolute top-[20px] left-[60px] right-[84px] h-[40px] z-30 pointer-events-none flex items-center px-1"
        >
          <MarqueeText
            text={displayArtist ? `${displayTitle} · ${displayArtist}` : displayTitle}
            className="text-xs font-bold text-slate-900 dark:text-white leading-tight"
            align="left"
          />
        </div>

        {/* Playback Controls */}
        <div
          ref={mobileControlsRef}
          style={{
            width: 200,
            height: 64,
            top: 9,
            right: 10,
            transformOrigin: 'top right',
            transform: 'scale(0.59375)',
          }}
          className="absolute flex items-center justify-center space-x-3 z-30 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={prevTrack}
            disabled={playlist.length <= 1}
            className="flex h-12 w-12 items-center justify-center rounded-full text-slate-700 active:scale-90 disabled:opacity-30 cursor-pointer dark:text-slate-200"
          >
            <SkipBack className="h-6 w-6" />
          </button>

          <button
            type="button"
            onClick={togglePlay}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white cursor-pointer transition-colors shadow-lg shadow-indigo-600/30"
          >
            {isPlaying ? (
              <Pause className="h-7 w-7 fill-current" />
            ) : (
              <Play className="h-7 w-7 fill-current ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={nextTrack}
            disabled={playlist.length <= 1}
            className="flex h-12 w-12 items-center justify-center rounded-full text-slate-700 active:scale-90 disabled:opacity-30 cursor-pointer dark:text-slate-200"
          >
            <SkipForward className="h-6 w-6" />
          </button>
        </div>

        {/* Header */}
        <div
          ref={mobileHeaderRef}
          style={{ opacity: 0 }}
          className="absolute top-0 inset-x-0 p-4 pt-2 z-20 pointer-events-auto"
        >
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="w-full pt-0 pb-1.5 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
          >
            <div className="w-12 h-1.5 rounded-full bg-slate-300 hover:bg-slate-400 dark:bg-white/35 dark:hover:bg-white/50 transition-colors" />
          </div>

          <div className="flex items-center justify-end pb-1">
            <button
              ref={closeBtnRef}
              type="button"
              onClick={handleCloseClick}
              title={
                isConfirmingClose
                  ? t('home.player.confirm_close') || '确认关闭'
                  : t('home.player.close') || '关闭播放器'
              }
              aria-label={
                isConfirmingClose
                  ? t('home.player.confirm_close') || '确认关闭'
                  : t('home.player.close') || '关闭播放器'
              }
              className={`relative flex items-center justify-start h-7 cursor-pointer active:scale-95 select-none overflow-hidden transition-colors duration-200 ${
                isConfirmingClose
                  ? 'bg-rose-50 border border-rose-300 text-rose-600 dark:bg-rose-950/80 dark:border-rose-700 dark:text-rose-300'
                  : 'bg-slate-100 text-slate-700 border border-transparent hover:text-rose-500 dark:bg-white/10 dark:text-slate-300 dark:hover:text-rose-400'
              }`}
              style={{ width: 28 }}
            >
              <div className="w-7 h-7 flex items-center justify-center shrink-0">
                <X className="h-3.5 w-3.5" />
              </div>
              <span
                ref={closeTextRef}
                style={{ opacity: 0, display: 'none' }}
                className="text-[11px] font-semibold whitespace-nowrap pr-2.5 pl-0.5 leading-none"
              >
                {t('home.player.confirm_close') || '确认关闭'}
              </span>
            </button>
          </div>
        </div>

        {/* Middle Playlist View (Apple Music Style Queue, animated via mobilePlaylistViewRef) */}
        <div
          ref={mobilePlaylistViewRef}
          style={{ display: 'none', opacity: 0 }}
          className="absolute inset-x-3.5 top-16 bottom-[146px] z-25 flex flex-col pointer-events-auto"
        >
          <PlaylistContent
            isMobile={true}
            showHeader={true}
            maxHeightClass="flex-1 min-h-0"
            className="h-full rounded-2xl bg-slate-100/70 border border-slate-200/70 overflow-hidden dark:bg-black/30 dark:border-white/10"
          />
        </div>

        {/* Scrubber */}
        <div
          ref={mobileScrubberRef}
          style={{ opacity: 0 }}
          className="absolute bottom-[102px] inset-x-6 z-20 space-y-1.5 pointer-events-auto"
        >
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={isScrubbing ? scrubValue : currentTime}
            onChange={handleScrubChange}
            onMouseUp={handleScrubCommit}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => {
              e.stopPropagation()
              handleScrubCommit()
            }}
            style={{
              background: `linear-gradient(to right, var(--color-indigo-500, #6366f1) 0%, var(--color-indigo-500, #6366f1) ${duration > 0 ? ((isScrubbing ? scrubValue : currentTime) / duration) * 100 : 0}%, var(--audio-slider-track, rgba(0, 0, 0, 0.12)) ${duration > 0 ? ((isScrubbing ? scrubValue : currentTime) / duration) * 100 : 0}%, var(--audio-slider-track, rgba(0, 0, 0, 0.12)) 100%)`,
            }}
            className="audio-mini-slider w-full h-2 cursor-pointer touch-none"
          />
          <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums px-0.5">
            <span>{formatAudioTime(isScrubbing ? scrubValue : currentTime)}</span>
            <span>{formatAudioTime(duration)}</span>
          </div>
        </div>

        {/* Side Controls */}
        <div
          ref={mobileSideControlsRef}
          style={{ opacity: 0 }}
          className="absolute bottom-4 inset-x-5 h-16 flex items-center justify-between z-20 pointer-events-auto"
        >
          <button
            type="button"
            onClick={handleCycleRepeatMode}
            className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-colors cursor-pointer active:scale-90 ${
              repeatMode !== 'off'
                ? 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/60'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10'
            }`}
          >
            {repeatMode === 'off' ? (
              <RepeatOff className="h-5 w-5" />
            ) : repeatMode === 'list' ? (
              <Repeat className="h-5 w-5" />
            ) : repeatMode === 'one' ? (
              <Repeat1 className="h-5 w-5" />
            ) : (
              <Shuffle className="h-5 w-5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => togglePlaylist()}
            className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-colors cursor-pointer active:scale-90 relative ${
              isPlaylistOpen
                ? 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/60'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10'
            }`}
          >
            <ListMusic className="h-5 w-5" />
            {playlist.length > 0 && (
              <span className="absolute top-1.5 right-1.5 px-1 min-w-[14px] text-[9px] font-mono font-bold leading-tight rounded-full bg-indigo-600 text-white flex items-center justify-center">
                {playlist.length}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
