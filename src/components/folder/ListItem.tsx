import React from 'react'
import { StoreObj } from '~/types'
import { getFileIcon } from '~/utils/icon'
import { getFileSize, formatDate } from '~/utils/str'
import { Check, Download } from 'lucide-react'
import { useDownload } from '~/hooks/useDownload'
import { useObjStore } from '~/store/useObjStore'
import { useSettingsStore } from '~/store/useSettingsStore'
import { useT } from '~/lang'
import { useAudioCover, isAudioObject } from '~/utils/audioCover'

interface ListItemProps {
  obj: StoreObj
  index: number
  onOpen: (obj: StoreObj) => void
  onSelect: (index: number, selected: boolean, e: React.MouseEvent) => void
  onContextMenu: (e: React.MouseEvent, obj: StoreObj) => void
  onTouchStartItem?: (index: number, e: React.TouchEvent) => void
  hasJustFinishedDrag?: () => boolean
}

export const ListItem: React.FC<ListItemProps> = ({
  obj,
  index,
  onOpen,
  onSelect,
  onContextMenu,
  onTouchStartItem,
  hasJustFinishedDrag,
}) => {
  const isSelected = !!obj.selected
  const hasSelection = useObjStore((state) => state.objs.some((o) => o.selected))
  const currentPath = useObjStore((state) => state.currentPath)
  const { downloadObj } = useDownload()
  const { getSettingBool } = useSettingsStore()
  const t = useT()

  const isAudio = isAudioObject(obj)
  const audioCover = useAudioCover(isAudio && !obj.thumb ? obj : null, currentPath)
  const effectiveThumb = obj.thumb || audioCover

  const handleClick = (e: React.MouseEvent) => {
    if (hasJustFinishedDrag && hasJustFinishedDrag()) {
      return
    }
    // If in multi-select mode (at least one object selected) or holding modifier keys
    if (e.ctrlKey || e.metaKey || e.shiftKey || hasSelection) {
      onSelect(index, !isSelected, e)
    } else {
      onOpen(obj)
    }
  }

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(index, !isSelected, e)
  }

  const handleQuickDownload = (e: React.MouseEvent) => {
    e.stopPropagation()
    downloadObj(obj)
  }

  const showPlainText = getSettingBool('show_disk_usage_in_plain_text')
  const details = obj.mount_details
  const totalSpace = details?.total_space ?? 0
  const usedSpace = details?.used_space ?? 0
  const percent = totalSpace > 0
    ? Math.min(100, Math.max(0, Math.round((usedSpace / totalSpace) * 100)))
    : 0

  return (
    <div
      data-index={index}
      onClick={handleClick}
      onTouchStart={(e) => onTouchStartItem?.(index, e)}
      onContextMenu={(e) => {
        if (window.innerWidth < 768 || hasSelection) {
          e.preventDefault()
          return
        }
        onContextMenu(e, obj)
      }}
      className={`viselect-item group flex items-center justify-between rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-2 sm:py-2.5 transition-all duration-150 cursor-pointer select-none active:scale-[0.99] ${
        isSelected
          ? 'bg-indigo-50/80 text-indigo-900 ring-1 ring-indigo-500/30 dark:bg-indigo-950/50 dark:text-indigo-200'
          : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
      }`}
    >
      {/* Left: Checkbox + Icon + Name */}
      <div className="flex items-center space-x-2 sm:space-x-3 overflow-hidden flex-1 mr-2 sm:mr-4">
        <button
          onClick={handleCheckboxClick}
          className={`flex h-3.5 w-3.5 sm:h-4 sm:w-4 items-center justify-center rounded border transition-all shrink-0 ${
            isSelected
              ? 'border-indigo-600 bg-indigo-600 text-white'
              : hasSelection
              ? 'border-slate-300 bg-white opacity-100 dark:border-slate-600 dark:bg-slate-800'
              : 'border-slate-300 bg-white opacity-0 group-hover:opacity-100 dark:border-slate-600 dark:bg-slate-800'
          }`}
        >
          {isSelected && <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 stroke-[3]" />}
        </button>

        <div className="shrink-0 flex items-center justify-center">
          {effectiveThumb ? (
            <img
              src={effectiveThumb}
              alt={obj.name}
              className="h-4 w-4 sm:h-5 sm:w-5 rounded object-cover shadow-2xs"
            />
          ) : (
            getFileIcon(obj, 'w-4 h-4 sm:w-5 sm:h-5')
          )}
        </div>

        <span
          title={obj.name}
          className={`truncate text-xs sm:text-sm font-medium ${
            isSelected ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : ''
          }`}
        >
          {obj.name}
        </span>
      </div>

      {/* Quick Download Hover Action */}
      {!obj.is_dir && (
        <button
          onClick={handleQuickDownload}
          title={t('home.preview.download') || 'Download'}
          className="mr-1.5 sm:mr-2 rounded-lg p-0.5 sm:p-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 dark:hover:text-indigo-400 transition-all shrink-0"
        >
          <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </button>
      )}

      {/* Center: Mount disk space or Size */}
      <div className="w-24 sm:w-36 text-right text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 shrink-0">
        {!obj.is_dir ? (
          getFileSize(obj.size)
        ) : totalSpace > 0 ? (
          showPlainText ? (
            <span
              className="font-mono text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400"
              title={`${getFileSize(usedSpace)} / ${getFileSize(totalSpace)}`}
            >
              {getFileSize(usedSpace)} / {getFileSize(totalSpace)}
            </span>
          ) : (
            <div
              className="flex items-center justify-end space-x-1 sm:space-x-1.5"
              title={`${percent}% (${getFileSize(usedSpace)} / ${getFileSize(totalSpace)})`}
            >
              <div className="w-10 sm:w-14 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    percent > 90 ? 'bg-rose-500' : percent > 75 ? 'bg-amber-500' : 'bg-indigo-500'
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="font-mono text-[9px] sm:text-[10px] text-slate-400 shrink-0">{percent}%</span>
            </div>
          )
        ) : usedSpace > 0 ? (
          <span className="font-mono text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">
            {getFileSize(usedSpace)}
          </span>
        ) : null}
      </div>

      {/* Right: Modified Date */}
      <div className="hidden sm:block w-36 text-right text-xs text-slate-400 dark:text-slate-500 shrink-0">
        {formatDate(obj.modified)}
      </div>
    </div>
  )
}
