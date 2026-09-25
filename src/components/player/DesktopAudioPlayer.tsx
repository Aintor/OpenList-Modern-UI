import React, { useLayoutEffect, useRef, useState } from 'react'
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
} from 'lucide-react'
import { useAudioPlayerStore, RepeatMode } from '~/store/useAudioPlayerStore'
import { Tooltip } from '~/components/ui/Tooltip'
import { useT } from '~/lang'
import { AudioMetadata } from '~/utils/audioMeta'
import { PlaylistContent } from '~/components/player/PlaylistContent'
import { VinylRecord } from '~/components/player/VinylRecord'
import { MarqueeText } from '~/components/player/MarqueeText'
import {
  DesktopPlayerMode,
  DesktopPlayerElements,
  applyDesktopModeInstant,
  runDesktopModeTransition,
} from '~/components/player/desktopPlayerGeometry'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(Draggable)
}

const formatAudioTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '00:00'
  const min = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}

interface DesktopAudioPlayerProps {
  metadata: AudioMetadata
  onSeek: (time: number) => void
}

export const DesktopAudioPlayer: React.FC<DesktopAudioPlayerProps> = ({
  metadata,
  onSeek,
}) => {
  const t = useT()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const discRef = useRef<HTMLDivElement | null>(null)
  const svgRingRef = useRef<SVGSVGElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const playlistViewRef = useRef<HTMLDivElement | null>(null)
  const scrubberRef = useRef<HTMLDivElement | null>(null)
  const controlsRef = useRef<HTMLDivElement | null>(null)
  const leftControlsRef = useRef<HTMLDivElement | null>(null)
  const centerControlsRef = useRef<HTMLDivElement | null>(null)
  const volumeBtnRef = useRef<HTMLButtonElement | null>(null)
  const volumeCapsuleRef = useRef<HTMLDivElement | null>(null)
  const volumeSliderWrapperRef = useRef<HTMLDivElement | null>(null)

  const draggableInstance = useRef<Draggable[] | null>(null)
  const currentModeRef = useRef<DesktopPlayerMode>('collapsed')

  const [isVolumeOpen, setIsVolumeOpen] = useState(false)
  const isVolumeFirstRender = useRef(true)
  const volumeTimerRef = useRef<NodeJS.Timeout | null>(null)

  const [isScrubbing, setIsScrubbing] = useState(false)
  const [scrubValue, setScrubValue] = useState(0)

  const {
    activeTrack,
    playlist,
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
    nextTrack,
    prevTrack,
    setVolume,
    toggleMute,
    setRepeatMode,
    togglePlaylist,
    setExpanded,
    closePlayer,
  } = useAudioPlayerStore()

  const targetMode: DesktopPlayerMode = !isExpanded
    ? 'collapsed'
    : isPlaylistOpen
    ? 'queue'
    : 'expanded'

  const getDesktopElements = (): DesktopPlayerElements => ({
    container: containerRef.current,
    card: cardRef.current,
    disc: discRef.current,
    svgRing: svgRingRef.current,
    content: contentRef.current,
    header: headerRef.current,
    playlistView: playlistViewRef.current,
    scrubber: scrubberRef.current,
    controls: controlsRef.current,
    volumeCapsule: volumeCapsuleRef.current,
  })

  // GSAP Draggable Setup
  useLayoutEffect(() => {
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
      cancel: 'input, button, select, textarea, [data-no-drag], [data-no-drag] *',
      onPress(e) {
        const target = e.target as (HTMLElement | SVGElement | null)
        if (
          target &&
          (target.closest?.('[data-no-drag]') ||
            target.closest?.('input, button, select, textarea') ||
            target.closest?.('.no-drag'))
        ) {
          this.endDrag(e)
        }
      },
    })

    return () => {
      if (draggableInstance.current) {
        draggableInstance.current.forEach((d) => d.kill())
        draggableInstance.current = null
      }
    }
  }, [activeTrack])

  // Single unified 3-State Morphing Transition Engine
  useLayoutEffect(() => {
    const prevMode = currentModeRef.current
    if (prevMode === targetMode) return
    currentModeRef.current = targetMode

    const elements = getDesktopElements()
    runDesktopModeTransition(prevMode, targetMode, elements, () => {
      draggableInstance.current?.[0]?.update()
    })
  }, [targetMode])

  // Initial Placement
  useLayoutEffect(() => {
    applyDesktopModeInstant(getDesktopElements(), targetMode)
  }, [])

  // Floating Volume Capsule animation
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
      let targetWidth = 116
      let startLeft = 0

      if (volumeBtnRef.current) {
        startLeft = volumeBtnRef.current.offsetLeft
      }

      if (leftControlsRef.current && centerControlsRef.current) {
        const leftRect = leftControlsRef.current.getBoundingClientRect()
        const centerRect = centerControlsRef.current.getBoundingClientRect()
        const anchorLeft = leftRect.left + startLeft
        const distanceToCenter = centerRect.left - anchorLeft
        // Leave at least 8px safety gap before center controls
        targetWidth = Math.max(80, Math.floor(distanceToCenter - 8))
      }

      gsap.set(capsule, { display: 'flex', left: startLeft })
      gsap.fromTo(
        capsule,
        { width: 36, opacity: 0 },
        { width: targetWidth, opacity: 1, duration: 0.24, ease: 'power3.out' }
      )
      gsap.fromTo(
        sliderWrapper,
        { opacity: 0, x: -6 },
        { opacity: 1, x: 0, duration: 0.2, delay: 0.04, ease: 'power2.out' }
      )
    } else {
      gsap.to(sliderWrapper, {
        opacity: 0,
        x: -6,
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

  if (!activeTrack) return null

  const handleVolumeMouseEnter = () => {
    if (volumeTimerRef.current) {
      clearTimeout(volumeTimerRef.current)
      volumeTimerRef.current = null
    }
  }

  const handleVolumeMouseLeave = () => {
    volumeTimerRef.current = setTimeout(() => {
      setIsVolumeOpen(false)
    }, 450)
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

  // Progress SVG Ring Constants
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const progressFraction = duration > 0 ? currentTime / duration : 0
  const strokeDashoffset = circumference - progressFraction * circumference

  const displayTitle = metadata.title || activeTrack.obj.name
  const displayArtist = metadata.artist

  return (
    <div className="hidden md:block">
      <div
        ref={containerRef}
        className="fixed bottom-6 right-6 z-50 select-none transition-shadow"
      >
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
            width: 52,
            height: 52,
            borderRadius: 26,
          }}
        >
          {/* Vinyl Disc & Progress SVG */}
          <div
            ref={discRef}
            className="absolute top-1.5 left-1.5 h-10 w-10 flex items-center justify-center pointer-events-none rounded-full z-20"
          >
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

            <VinylRecord
              size={34}
              coverUrl={metadata.coverUrl}
              isPlaying={isPlaying}
              loading={loading}
              duration={duration}
              alt={activeTrack.obj.name}
            />
          </div>

          {/* In-Card Expanded & Queue Content Container */}
          <div
            ref={contentRef}
            className="absolute inset-0 p-3.5 flex flex-col justify-between"
            style={{ display: 'none', opacity: 0 }}
          >
            {/* Header Row */}
            <div ref={headerRef} className="flex items-center justify-between shrink-0">
              <div className="min-w-0 flex-1 pl-12 pr-3">
                <MarqueeText
                  text={displayTitle}
                  className="text-xs font-bold text-slate-900 dark:text-white leading-tight"
                  align="left"
                />
                {displayArtist && (
                  <MarqueeText
                    text={displayArtist}
                    className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight mt-0.5"
                    align="left"
                  />
                )}
              </div>

              <div className="flex items-center space-x-1 shrink-0">
                <Tooltip content={t('home.player.close') || '关闭播放器'} side="top">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      closePlayer()
                    }}
                    className="rounded-lg p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 active:scale-95 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </Tooltip>
              </div>
            </div>

            {/* Embedded Middle Playlist View (Native 3-State In-Card Queue) */}
            <div
              ref={playlistViewRef}
              data-no-drag
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              style={{ display: 'none', opacity: 0 }}
              className="my-2.5 flex-1 min-h-0 flex flex-col rounded-2xl bg-slate-100/70 border border-slate-200/70 overflow-hidden dark:bg-black/30 dark:border-white/10"
            >
              <PlaylistContent
                isMobile={false}
                showHeader={false}
                maxHeightClass="flex-1 min-h-0"
                className="h-full"
              />
            </div>

            {/* Bottom Controls Dock (Scrubber + Controls Bar sliding in 1:1 sync with card expansion) */}
            <div className="flex flex-col space-y-1.5 shrink-0">
              {/* Scrubber Slider Row */}
              <div
                ref={scrubberRef}
                data-no-drag
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                className="flex items-center space-x-2.5 shrink-0"
              >
              <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 tabular-nums select-none shrink-0 w-8 text-left">
                {formatAudioTime(isScrubbing ? scrubValue : currentTime)}
              </span>

              <div className="flex-1 flex items-center">
                {(() => {
                  const progressPercent = duration
                    ? ((isScrubbing ? scrubValue : currentTime) / duration) * 100
                    : 0
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
            <div ref={controlsRef} className="grid grid-cols-3 items-center shrink-0">
              {/* Left: Volume & Repeat Mode */}
              <div
                ref={leftControlsRef}
                className="relative flex items-center justify-start space-x-0.5 h-10 select-none"
              >
                {/* Volume Button (Slot 1 on the left) */}
                <Tooltip content={t('home.player.volume') || '音量'} side="top">
                  <button
                    ref={volumeBtnRef}
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

                {/* Repeat Mode Button (Slot 2) */}
                <Tooltip
                  content={
                    repeatMode === 'off'
                      ? t('home.player.repeat_off') || '停止循环'
                      : repeatMode === 'list'
                      ? t('home.player.list_repeat') || '列表循环'
                      : repeatMode === 'one'
                      ? t('home.player.one_repeat') || '单曲循环'
                      : t('home.player.shuffle') || '随机播放'
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

                {/* Floating Volume Capsule (Expanding from Leftmost edge up to before Center Controls) */}
                <div
                  ref={volumeCapsuleRef}
                  style={{ display: 'none', width: 36, opacity: 0 }}
                  onMouseEnter={handleVolumeMouseEnter}
                  onMouseLeave={handleVolumeMouseLeave}
                  className="absolute top-1/2 -translate-y-1/2 z-30 flex items-center justify-start bg-white/95 border border-slate-200/90 text-slate-800 rounded-full pl-1 pr-2.5 py-1 shadow-2xl shadow-slate-900/15 backdrop-blur-2xl overflow-hidden dark:bg-slate-900/95 dark:border-white/20 dark:text-white dark:shadow-black/80"
                >
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="p-1 rounded-full text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors cursor-pointer shrink-0"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="h-3.5 w-3.5 text-rose-400" />
                    ) : (
                      <Volume2 className="h-3.5 w-3.5" />
                    )}
                  </button>

                  <div
                    ref={volumeSliderWrapperRef}
                    className="flex-1 min-w-0 flex items-center pl-1 shrink"
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
                            const val = parseFloat(e.target.value)
                            setVolume(val)
                          }}
                          style={{
                            background: `linear-gradient(to right, var(--color-indigo-500, #6366f1) 0%, var(--color-indigo-500, #6366f1) ${volumePercent}%, var(--audio-slider-track, rgba(0, 0, 0, 0.12)) ${volumePercent}%, var(--audio-slider-track, rgba(0, 0, 0, 0.12)) 100%)`,
                          }}
                          className="audio-mini-slider w-full h-1.5"
                        />
                      )
                    })()}
                  </div>
                </div>
              </div>

              {/* Center: Prev / Play / Next */}
              <div
                ref={centerControlsRef}
                className="flex items-center justify-center space-x-2"
              >
                <button
                  type="button"
                  onClick={prevTrack}
                  disabled={playlist.length <= 1}
                  className="rounded-xl p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95 disabled:opacity-30 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/10 transition-all cursor-pointer"
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
                  className="rounded-xl p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95 disabled:opacity-30 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/10 transition-all cursor-pointer"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
              </div>

              {/* Right: Playlist & Minimize */}
              <div className="relative flex items-center justify-end space-x-0.5 h-10 select-none">
                <Tooltip content={t('home.player.playlist') || '播放列表'} side="top">
                  <button
                    type="button"
                    onClick={() => togglePlaylist()}
                    className={`relative flex items-center justify-center rounded-xl p-2 transition-colors cursor-pointer shrink-0 ${
                      isPlaylistOpen
                        ? 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/60'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10'
                    }`}
                  >
                    <div className="relative flex items-center justify-center">
                      <ListMusic className="h-4 w-4" />
                      {playlist.length > 0 && (
                        <span className="absolute -top-1.5 -right-2 px-1 min-w-[13px] h-[13px] text-[8px] font-mono font-bold leading-none rounded-full bg-indigo-600 text-white flex items-center justify-center pointer-events-none ring-1.5 ring-white dark:ring-slate-900 shadow-xs">
                          {playlist.length}
                        </span>
                      )}
                    </div>
                  </button>
                </Tooltip>

                <Tooltip content={t('home.player.minimize') || '收起播放器'} side="top">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setExpanded(false)
                      togglePlaylist(false)
                    }}
                    className="rounded-xl p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 active:scale-95 dark:text-slate-400 dark:hover:text-indigo-400 dark:hover:bg-indigo-950/60 transition-colors cursor-pointer shrink-0"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </button>
                </Tooltip>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
