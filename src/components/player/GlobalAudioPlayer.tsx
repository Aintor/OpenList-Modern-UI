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
  ChevronDown,
} from 'lucide-react'
import { useAudioPlayerStore, RepeatMode } from '~/store/useAudioPlayerStore'
import { Tooltip } from '~/components/ui/Tooltip'
import { useT } from '~/lang'
import { useAudioCover } from '~/utils/audioCover'
import { globalAudioEngine } from '~/utils/audio'
import { PlaylistContent } from '~/components/player/PlaylistContent'
import {
  MobilePlayerMode,
  MobilePlayerElements,
  applyModeGeometryInstant,
  runModeTransition,
  interpolateModeProgress,
} from '~/components/player/mobilePlayerGeometry'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(Draggable)
}

const formatAudioTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '00:00'
  const min = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}

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
        isSpinning ? 'border-indigo-500 text-indigo-400' : 'border-white/20 text-slate-400'
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

export const GlobalAudioPlayer: React.FC = () => {
  const t = useT()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const discRef = useRef<HTMLDivElement | null>(null)
  const svgRingRef = useRef<SVGSVGElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const playlistDrawerRef = useRef<HTMLDivElement | null>(null)
  const draggableInstance = useRef<Draggable[] | null>(null)
  
  const mobileCardRef = useRef<HTMLDivElement | null>(null)
  const mobileDiscRef = useRef<HTMLDivElement | null>(null)
  const mobileControlsRef = useRef<HTMLDivElement | null>(null)
  const mobileTitleRef = useRef<HTMLDivElement | null>(null)
  const mobileTopTitleRef = useRef<HTMLDivElement | null>(null)
  const mobileTimeSubtitleRef = useRef<HTMLParagraphElement | null>(null)
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
  const prevExpandedRef = useRef(false)

  const [isVolumeOpen, setIsVolumeOpen] = useState(false)
  const volumeCapsuleRef = useRef<HTMLDivElement | null>(null)
  const volumeSliderWrapperRef = useRef<HTMLDivElement | null>(null)
  const isVolumeFirstRender = useRef(true)
  const volumeTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [isScrubbing, setIsScrubbing] = useState(false)
  const isScrubbingRef = useRef(false)
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
    setVolume,
    toggleMute,
    setRepeatMode,
    togglePlaylist,
    setExpanded,
    closePlayer,
    updateTime,
  } = useAudioPlayerStore()

  const coverUrl = useAudioCover(activeTrack?.obj || null, activeTrack?.path || '/')

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

  const getMobileElements = (): MobilePlayerElements => ({
    card: mobileCardRef.current,
    disc: mobileDiscRef.current,
    controls: mobileControlsRef.current,
    title: mobileTitleRef.current,
    topTitle: mobileTopTitleRef.current,
    timeSubtitle: mobileTimeSubtitleRef.current,
    header: mobileHeaderRef.current,
    scrubber: mobileScrubberRef.current,
    sideControls: mobileSideControlsRef.current,
    backdrop: mobileBackdropRef.current,
    hairline: mobileProgressHairlineRef.current,
    playlistView: mobilePlaylistViewRef.current,
  })

  const targetMobileMode: MobilePlayerMode = !isExpanded
    ? 'collapsed'
    : isPlaylistOpen
    ? 'queue'
    : 'expanded'

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

  const handleMobileClose = () => {
    if (isPlaylistOpen) togglePlaylist(false)
    setExpanded(false)
  }

  // Mobile Interactive Touch Drag Handlers (1:1 跟手拖拽)
  const handleTouchStart = (e: React.TouchEvent) => {
    mobileTouchStartY.current = e.touches[0].clientY
    mobileCurrentDragY.current = 0
    isMobileDraggingRef.current = true
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobileDraggingRef.current) return
    const deltaY = e.touches[0].clientY - mobileTouchStartY.current
    if (deltaY > 0) {
      mobileCurrentDragY.current = deltaY
      const progress = Math.min(1, Math.max(0, deltaY / 240))
      const fromMode = currentMobileModeRef.current === 'queue' ? 'queue' : 'expanded'
      const cardWidth = mobileCardRef.current?.clientWidth || 360
      interpolateModeProgress(fromMode, progress, getMobileElements(), cardWidth)
    }
  }

  const handleTouchEnd = () => {
    if (!isMobileDraggingRef.current) return
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

  // Desktop morphing & boundary clamping
  useLayoutEffect(() => {
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
      const rect = container.getBoundingClientRect()
      const margin = 16
      const targetWidth = 384
      const targetHeight = 160

      let deltaX = 0
      let deltaY = 0

      const futureRight = rect.left + targetWidth
      const futureLeft = rect.left
      if (futureRight > window.innerWidth - margin) {
        deltaX = (window.innerWidth - margin) - futureRight
      } else if (futureLeft < margin) {
        deltaX = margin - futureLeft
      }

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

      if (deltaX !== 0 || deltaY !== 0) {
        tl.to(container, {
          x: `+=${deltaX}`,
          y: `+=${deltaY}`,
          duration: 0.4,
        }, 0)
      }

      tl.fromTo(card, { width: 52, height: 52, borderRadius: 26 }, { width: 384, height: 160, borderRadius: 24, duration: 0.4 }, 0)
      tl.fromTo(disc, { x: 0, y: 0, scale: 1 }, { x: 10, y: 8, scale: 0.9, duration: 0.4 }, 0)
      if (svgRing) tl.to(svgRing, { opacity: 0, duration: 0.14 }, 0)
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
      tl.to(content, {
        opacity: 0,
        y: 4,
        duration: 0.12,
        ease: 'power2.in',
        onComplete: () => {
          gsap.set(content, { display: 'none' })
        },
      }, 0)
      tl.fromTo(card, { width: 384, height: 160, borderRadius: 24 }, { width: 52, height: 52, borderRadius: 26, duration: 0.36 }, 0.04)
      tl.fromTo(disc, { x: 10, y: 8, scale: 0.9 }, { x: 0, y: 0, scale: 1, duration: 0.36 }, 0.04)
      if (svgRing) tl.to(svgRing, { opacity: 1, duration: 0.2 }, 0.12)
    }
  }, [isExpanded])

  // Desktop playlist drawer flyout animation
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

  // Desktop volume capsule animation
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

  const lastRawUrlRef = useRef<string | null>(null)

  // Synchronize globalAudioEngine with active track & playback state
  useEffect(() => {
    if (!activeTrack?.rawUrl) {
      lastRawUrlRef.current = null
      globalAudioEngine.stop()
      return
    }

    if (lastRawUrlRef.current !== activeTrack.rawUrl) {
      lastRawUrlRef.current = activeTrack.rawUrl
      globalAudioEngine.play(
        {
          rawUrl: activeTrack.rawUrl,
          name: activeTrack.obj.name,
          size: activeTrack.obj.size,
        },
        0
      )
    }
  }, [activeTrack?.rawUrl])

  useEffect(() => {
    if (isPlaying) {
      globalAudioEngine.resume()
    } else {
      globalAudioEngine.pause()
    }
  }, [isPlaying])

  useEffect(() => {
    globalAudioEngine.setVolume(volume)
    globalAudioEngine.setMuted(isMuted)
  }, [volume, isMuted])

  useEffect(() => {
    const unbindTime = globalAudioEngine.on('timeupdate', ({ currentTime: cur, duration: dur }) => {
      if (!isScrubbingRef.current) {
        updateTime(cur, dur)
      }
    })

    const unbindEnded = globalAudioEngine.on('ended', () => {
      const state = useAudioPlayerStore.getState()
      if (state.repeatMode === 'one') {
        globalAudioEngine.seek(0)
        globalAudioEngine.resume()
      } else if (state.repeatMode === 'off') {
        if (state.currentIndex >= state.playlist.length - 1) {
          state.pause()
        } else {
          state.nextTrack()
        }
      } else {
        state.nextTrack()
      }
    })

    return () => {
      unbindTime()
      unbindEnded()
    }
  }, [updateTime])

  // Responsive resize sync across 768px breakpoint
  useEffect(() => {
    const handleResize = () => {
      const isDesktop = window.innerWidth >= 768
      if (isDesktop && containerRef.current && cardRef.current) {
        draggableInstance.current?.[0]?.update(true)
        if (isExpanded) {
          gsap.set(cardRef.current, { width: 384, height: 160, borderRadius: 24, overflow: 'visible' })
          if (discRef.current) gsap.set(discRef.current, { x: 10, y: 8, scale: 0.9 })
          if (contentRef.current) gsap.set(contentRef.current, { display: 'flex', opacity: 1, y: 0 })
          if (svgRingRef.current) gsap.set(svgRingRef.current, { opacity: 0 })
        } else {
          gsap.set(cardRef.current, { width: 52, height: 52, borderRadius: 26, overflow: 'hidden' })
          if (discRef.current) gsap.set(discRef.current, { x: 0, y: 0, scale: 1 })
          if (contentRef.current) gsap.set(contentRef.current, { display: 'none', opacity: 0 })
          if (svgRingRef.current) gsap.set(svgRingRef.current, { opacity: 1 })
        }
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isExpanded])

  // MediaSession API integration
  useEffect(() => {
    if (!activeTrack || !('mediaSession' in navigator)) return

    navigator.mediaSession.metadata = new MediaMetadata({
      title: activeTrack.obj.name,
      artist: 'OpenList Audio',
      album: activeTrack.path,
      ...(coverUrl ? { artwork: [{ src: coverUrl }] } : {}),
    })

    navigator.mediaSession.setActionHandler('play', () => resume())
    navigator.mediaSession.setActionHandler('pause', () => pause())
    navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack())
    navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack())
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) {
        globalAudioEngine.seek(details.seekTime)
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

  const handleScrubChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setScrubValue(val)
    isScrubbingRef.current = true
    if (!isScrubbing) setIsScrubbing(true)
  }

  const handleScrubCommit = () => {
    isScrubbingRef.current = false
    setIsScrubbing(false)
    globalAudioEngine.seek(scrubValue)
    seekTo(scrubValue)
  }

  const handleCycleRepeatMode = () => {
    const modes: RepeatMode[] = ['list', 'one', 'shuffle', 'off']
    const nextMode = modes[(modes.indexOf(repeatMode) + 1) % modes.length]
    setRepeatMode(nextMode)
  }

  const handlePrev = (e: React.MouseEvent<HTMLButtonElement>) => {
    gsap.fromTo(
      e.currentTarget,
      { scale: 0.78, x: -4 },
      { scale: 1, x: 0, duration: 0.35, ease: 'back.out(3)', overwrite: 'auto' }
    )
    prevTrack()
  }

  const handleNext = (e: React.MouseEvent<HTMLButtonElement>) => {
    gsap.fromTo(
      e.currentTarget,
      { scale: 0.78, x: 4 },
      { scale: 1, x: 0, duration: 0.35, ease: 'back.out(3)', overwrite: 'auto' }
    )
    nextTrack()
  }

  const handleTogglePlay = (e: React.MouseEvent<HTMLButtonElement>) => {
    gsap.fromTo(
      e.currentTarget,
      { scale: 0.84 },
      { scale: 1, duration: 0.35, ease: 'back.out(3)', overwrite: 'auto' }
    )
    togglePlay()
  }

  const radius = 22
  const circumference = 2 * Math.PI * radius
  const progressRatio = duration > 0 ? currentTime / duration : 0
  const strokeDashoffset = circumference * (1 - progressRatio)
  const isDiscSpinning = isPlaying && duration > 0 && !loading

  return (
    <>
      {/* Desktop Player (>= 768px) */}
      <div
        ref={containerRef}
        className="hidden md:block fixed bottom-6 left-6 z-40 select-none touch-none pointer-events-auto"
      >
        {/* Playlist Drawer */}
        <div
          ref={playlistDrawerRef}
          style={{ display: 'none' }}
          data-no-drag="true"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="playlist-drawer absolute bottom-full mb-3 left-0 w-80 sm:w-96 max-h-80 flex flex-col rounded-3xl border border-slate-200/80 bg-white/95 text-slate-800 shadow-2xl shadow-slate-900/15 backdrop-blur-2xl overflow-hidden pointer-events-auto z-10 dark:border-white/10 dark:bg-slate-900/95 dark:text-slate-100 dark:shadow-black/60"
        >
          <PlaylistContent
            onClose={() => togglePlaylist(false)}
            showCloseButton={true}
            maxHeightClass="max-h-64"
          />
        </div>

        {/* Desktop Morphing Card */}
        <div
          ref={cardRef}
          onClick={() => {
            if (!isExpanded) setExpanded(true)
          }}
          className={`relative z-20 border border-slate-200/80 bg-white/95 text-slate-800 shadow-xl shadow-slate-900/10 backdrop-blur-2xl dark:border-white/12 dark:bg-slate-900/95 dark:text-white dark:shadow-2xl dark:shadow-black/60 ${
            isExpanded ? 'overflow-visible' : 'overflow-hidden'
          } ${
            !isExpanded ? 'cursor-pointer hover:scale-105 active:scale-95 transition-transform' : ''
          }`}
          style={{
            width: isExpanded ? 384 : 52,
            height: isExpanded ? 160 : 52,
            borderRadius: isExpanded ? 24 : 26,
          }}
        >
          <div
            ref={discRef}
            style={{
              transform: isExpanded ? 'translate(10px, 8px) scale(0.9)' : 'none',
            }}
            className="absolute top-1.5 left-1.5 h-10 w-10 flex items-center justify-center pointer-events-none rounded-full z-20"
          >
            <svg
              ref={svgRingRef}
              style={{ opacity: isExpanded ? 0 : 1 }}
              className="absolute inset-0 h-full w-full -rotate-90 pointer-events-none"
              viewBox="0 0 48 48"
            >
              <circle
                cx="24"
                cy="24"
                r={radius}
                fill="none"
                className="stroke-slate-200 dark:stroke-white/12"
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

            <div
              className={`relative flex h-8.5 w-8.5 items-center justify-center rounded-full bg-slate-900 text-white border-2 transition-colors duration-300 shadow-inner overflow-hidden ${
                isDiscSpinning
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-slate-300/80 dark:border-white/20 text-slate-400'
              }`}
            >
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={activeTrack.obj.name}
                  className="h-full w-full object-cover animate-spin rounded-full"
                  style={{
                    animationDuration: '6s',
                    animationPlayState: isDiscSpinning ? 'running' : 'paused',
                  }}
                />
              ) : (loading || duration === 0) && isPlaying ? (
                <Loader2 className="h-4.5 w-4.5 animate-spin text-indigo-400" />
              ) : (
                <Disc3
                  className="h-5 w-5 animate-spin transition-opacity"
                  style={{
                    animationDuration: '4s',
                    animationPlayState: isDiscSpinning ? 'running' : 'paused',
                    opacity: isDiscSpinning ? 1 : 0.65,
                  }}
                />
              )}
            </div>
          </div>

          <div
            ref={contentRef}
            className="absolute inset-0 p-3.5 flex flex-col justify-between"
            style={{ display: isExpanded ? 'flex' : 'none' }}
          >
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1 pl-12 pr-3">
                <h4
                  title={activeTrack.obj.name}
                  className="truncate text-xs font-bold text-slate-900 dark:text-white leading-tight"
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
                    className="rounded-lg p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </Tooltip>
              </div>
            </div>

            {/* Scrubber slider row */}
            <div className="flex items-center space-x-2.5">
              <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 tabular-nums select-none shrink-0 w-8 text-left">
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
                        background: `linear-gradient(to right, var(--color-indigo-500, #6366f1) 0%, var(--color-indigo-500, #6366f1) ${progressPercent}%, var(--audio-slider-track, rgba(0, 0, 0, 0.12)) ${progressPercent}%, var(--audio-slider-track, rgba(0, 0, 0, 0.12)) 100%)`,
                      }}
                      className="audio-mini-slider w-full"
                    />
                  )
                })()}
              </div>

              <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 tabular-nums select-none shrink-0 w-8 text-right">
                {formatAudioTime(duration)}
              </span>
            </div>

            {/* 3-Column Controls Bar */}
            <div className="grid grid-cols-3 items-center">
              {/* Left: Minimize & Repeat Mode */}
              <div className="flex items-center justify-start space-x-0.5">
                <Tooltip content={t('home.player.minimize') || '收起为黑胶胶囊'} side="top">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setExpanded(false)
                      togglePlaylist(false)
                    }}
                    className="rounded-xl p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 active:scale-95 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10 transition-colors cursor-pointer"
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
                        ? 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/60'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10'
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

              {/* Center: Prev / Play / Next */}
              <div className="flex items-center justify-center space-x-2">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={playlist.length <= 1}
                  className="rounded-xl p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95 disabled:opacity-30 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/10 transition-all cursor-pointer"
                >
                  <SkipBack className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={handleTogglePlay}
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
                  onClick={handleNext}
                  disabled={playlist.length <= 1}
                  className="rounded-xl p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95 disabled:opacity-30 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/10 transition-all cursor-pointer"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
              </div>

              {/* Right: Volume & Playlist */}
              <div className="relative flex items-center justify-end space-x-1 h-10 select-none">
                <Tooltip content={t('home.player.playlist') || '播放列表'} side="top">
                  <button
                    type="button"
                    onClick={() => togglePlaylist()}
                    className={`relative flex items-center space-x-1 rounded-xl p-2 transition-colors cursor-pointer shrink-0 ${
                      isPlaylistOpen
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10'
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

                <Tooltip content={t('home.player.volume') || '音量'} side="top">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsVolumeOpen(true)
                    }}
                    className="rounded-xl p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="h-4 w-4 text-rose-400" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </button>
                </Tooltip>

                {/* Floating Volume Capsule */}
                <div
                  ref={volumeCapsuleRef}
                  style={{ display: 'none', width: 36, opacity: 0 }}
                  onMouseEnter={handleVolumeMouseEnter}
                  onMouseLeave={handleVolumeMouseLeave}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-30 flex items-center justify-end bg-white/95 border border-slate-200/90 text-slate-800 rounded-full pl-3.5 pr-1.5 py-1 shadow-2xl shadow-slate-900/15 backdrop-blur-2xl overflow-hidden dark:bg-slate-900/95 dark:border-white/20 dark:text-white dark:shadow-black/80"
                >
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
                            background: `linear-gradient(to right, var(--color-indigo-500, #6366f1) 0%, var(--color-indigo-500, #6366f1) ${volumePercent}%, var(--audio-slider-track, rgba(0, 0, 0, 0.12)) ${volumePercent}%, var(--audio-slider-track, rgba(0, 0, 0, 0.12)) 100%)`,
                          }}
                          className="audio-mini-slider w-15"
                        />
                      )
                    })()}
                  </div>

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
                          ? 'text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:text-rose-300 dark:hover:bg-rose-500/10'
                          : 'text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:text-white dark:hover:bg-white/10'
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

      {/* Mobile Player (< 768px) */}
      <div className="block md:hidden">
        {/* Backdrop */}
        <div
          ref={mobileBackdropRef}
          onClick={handleMobileClose}
          style={{ opacity: 0, pointerEvents: 'none' }}
          className="fixed inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-xs z-30 transition-opacity"
        />

        {/* Mobile Morphing Card */}
        <div
          ref={mobileCardRef}
          onClick={() => {
            if (!isExpanded) setExpanded(true)
          }}
          style={{ height: 56, borderRadius: 20 }}
          className={`fixed bottom-4 inset-x-3.5 z-40 border border-slate-200/80 bg-white/95 text-slate-800 shadow-2xl backdrop-blur-2xl overflow-hidden select-none dark:border-white/15 dark:bg-slate-900/95 dark:text-white ${
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
            <div
              className={`relative flex h-full w-full items-center justify-center rounded-full bg-slate-900 text-white border-2 transition-colors duration-300 overflow-hidden shadow-inner ${
                isDiscSpinning ? 'border-indigo-500 text-indigo-400' : 'border-slate-300/80 dark:border-white/20 text-slate-400'
              }`}
            >
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={activeTrack.obj.name}
                  className="h-full w-full object-cover animate-spin rounded-full"
                  style={{
                    animationDuration: '6s',
                    animationPlayState: isDiscSpinning ? 'running' : 'paused',
                  }}
                />
              ) : (loading || duration === 0) && isPlaying ? (
                <Loader2 className="h-1/2 w-1/2 animate-spin text-indigo-400" />
              ) : (
                <Disc3
                  className="h-3/4 w-3/4 animate-spin transition-opacity"
                  style={{
                    animationDuration: '4s',
                    animationPlayState: isDiscSpinning ? 'running' : 'paused',
                    opacity: isDiscSpinning ? 1 : 0.65,
                  }}
                />
              )}
            </div>
          </div>

          {/* Title & Subtitle */}
          <div
            ref={mobileTitleRef}
            style={{
              top: 10,
              left: 54,
              right: 128,
              textAlign: 'center',
            }}
            className="absolute z-20 pointer-events-none flex flex-col justify-center"
          >
            <h4
              title={activeTrack.obj.name}
              className="truncate block w-full text-xs font-bold text-slate-900 dark:text-white leading-tight"
            >
              {activeTrack.obj.name}
            </h4>
            <p
              ref={mobileTimeSubtitleRef}
              className="truncate block w-full text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5"
            >
              {formatAudioTime(currentTime)} / {formatAudioTime(duration)}
            </p>
          </div>

          {/* Top Mini Track Title (Playlist Mode, floats in from below) */}
          <div
            ref={mobileTopTitleRef}
            style={{ display: 'none', opacity: 0 }}
            className="absolute top-[20px] left-[60px] right-[84px] h-[40px] z-30 pointer-events-none flex items-center"
          >
            <h4
              title={activeTrack.obj.name}
              className="truncate w-full text-xs font-bold text-slate-900 dark:text-white leading-tight"
            >
              {activeTrack.obj.name}
            </h4>
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
              onClick={handlePrev}
              disabled={playlist.length <= 1}
              className="flex h-12 w-12 items-center justify-center rounded-full text-slate-700 active:scale-90 disabled:opacity-30 cursor-pointer dark:text-slate-200"
            >
              <SkipBack className="h-6 w-6" />
            </button>

            <button
              type="button"
              onClick={handleTogglePlay}
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
              onClick={handleNext}
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

            <div className="flex items-center justify-end space-x-1.5 pb-1">
              <button
                type="button"
                onClick={handleMobileClose}
                title="收起"
                className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 text-slate-700 active:scale-95 cursor-pointer dark:bg-white/10 dark:text-slate-300"
              >
                <ChevronDown className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={closePlayer}
                className="rounded-xl bg-slate-100 p-1.5 text-slate-700 hover:text-rose-500 active:scale-95 cursor-pointer dark:bg-white/10 dark:text-slate-300 dark:hover:text-rose-400"
              >
                <X className="h-3.5 w-3.5" />
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
            className="absolute bottom-[102px] inset-x-6 z-20 space-y-1 pointer-events-auto"
          >
            <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums px-0.5">
              <span>{formatAudioTime(isScrubbing ? scrubValue : currentTime)}</span>
              <span>{formatAudioTime(duration)}</span>
            </div>
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
                background: `linear-gradient(to right, var(--color-indigo-500, #6366f1) 0%, var(--color-indigo-500, #6366f1) ${duration > 0 ? ((isScrubbing ? scrubValue : currentTime) / duration) * 100 : 0}%, var(--audio-slider-track, rgba(0, 0, 0, 0.12)) ${duration > 0 ? ((isScrubbing ? scrubValue : currentTime) / duration) * 100 : 0}%, var(--audio-slider-track, rgba(0, 0, 0, 0.12)) 100%)`,
              }}
              className="audio-mini-slider w-full h-2 cursor-pointer"
            />
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
    </>
  )
}
