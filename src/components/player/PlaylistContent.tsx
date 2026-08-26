import React, { useRef, useState } from 'react'
import {
  ListMusic,
  Trash2,
  X,
  GripVertical,
} from 'lucide-react'
import { useAudioPlayerStore } from '~/store/useAudioPlayerStore'
import { Tooltip } from '~/components/ui/Tooltip'
import { useT } from '~/lang'

interface PlaylistContentProps {
  onClose?: () => void
  showHeader?: boolean
  showCloseButton?: boolean
  maxHeightClass?: string
  className?: string
  isMobile?: boolean
}

export const PlaylistContent: React.FC<PlaylistContentProps> = ({
  onClose,
  showHeader = true,
  showCloseButton = false,
  maxHeightClass = 'max-h-64',
  className = '',
  isMobile = false,
}) => {
  const t = useT()
  const {
    playlist,
    currentIndex,
    isPlaying,
    playTrack,
    removeTrack,
    moveTrack,
    clearPlaylist,
  } = useAudioPlayerStore()

  const [dragState, setDragState] = useState<{
    startIndex: number
    deltaY: number
    targetIndex: number
    itemHeight: number
  } | null>(null)

  const itemElementsRef = useRef<(HTMLDivElement | null)[]>([])

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

  return (
    <div className={`flex flex-col select-none ${className}`}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between border-b border-slate-200/80 px-3.5 py-2 bg-slate-50/80 dark:border-white/10 dark:bg-white/5 shrink-0">
          <div className="flex items-center space-x-2">
            <ListMusic className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              {t('home.player.playlist') || '播放列表'} ({playlist.length})
            </span>
          </div>

          <div className="flex items-center space-x-1">
            {playlist.length > 0 && (
              <Tooltip content={t('home.player.clear_playlist') || '清空列表'} side="top">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    clearPlaylist()
                  }}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 active:scale-95 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
            )}

            {showCloseButton && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-900 hover:bg-slate-100 active:scale-95 dark:hover:text-white dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Playlist Items */}
      <div
        className={`flex-1 overflow-y-auto overscroll-contain p-1.5 space-y-0.5 ${maxHeightClass}`}
      >
        {playlist.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500 space-y-1">
            <ListMusic className="h-7 w-7 stroke-1" />
            <span className="text-xs">{t('home.player.empty_playlist') || '播放列表为空'}</span>
          </div>
        ) : (
          playlist.map((track, idx) => {
            const isCurrent = idx === currentIndex
            const isDraggingThis = dragState?.startIndex === idx

            let translateY = 0
            if (dragState) {
              if (isDraggingThis) {
                translateY = dragState.deltaY
              } else {
                const { startIndex, targetIndex, itemHeight } = dragState
                if (targetIndex > startIndex) {
                  if (idx > startIndex && idx <= targetIndex) {
                    translateY = -itemHeight
                  }
                } else if (targetIndex < startIndex) {
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
                    ? 'bg-slate-100 ring-1 ring-indigo-500/80 shadow-2xl text-slate-900 scale-[1.02] dark:bg-slate-800 dark:ring-indigo-400/80 dark:shadow-black/80 dark:text-white'
                    : isCurrent
                    ? 'bg-indigo-50/90 border border-indigo-200/80 text-indigo-900 font-semibold dark:bg-indigo-600/30 dark:text-indigo-300 dark:border-indigo-500/30'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white active:bg-slate-100 dark:active:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div
                    onPointerDown={(e) => handleGripPointerDown(e, idx)}
                    className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-indigo-500 p-0.5 rounded transition-colors shrink-0 touch-none dark:text-slate-500 dark:hover:text-indigo-300"
                    title="按住上下滑动排序"
                  >
                    <GripVertical className="h-3.5 w-3.5" />
                  </div>

                  {isCurrent && (
                    <div className="flex items-end space-x-0.5 h-3.5 w-3 shrink-0 pb-0.5">
                      {isPlaying ? (
                        <>
                          <span className="w-0.5 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s] h-full"></span>
                          <span className="w-0.5 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s] h-2/3"></span>
                          <span className="w-0.5 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-bounce h-4/5"></span>
                        </>
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 m-auto"></span>
                      )}
                    </div>
                  )}

                  <span title={track.obj.name} className="truncate block min-w-0 flex-1">
                    {track.obj.name}
                  </span>
                </div>

                {!dragState && (
                  <Tooltip content={t('home.player.remove_from_playlist') || '从列表中移除'} side="top">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeTrack(idx)
                      }}
                      className={`${
                        isMobile ? 'opacity-70 hover:opacity-100' : 'opacity-0 group-hover:opacity-100'
                      } rounded p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 active:scale-90 dark:hover:bg-rose-500/10 transition-all cursor-pointer shrink-0 ml-1.5`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
