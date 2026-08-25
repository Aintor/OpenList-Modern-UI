import React from 'react'
import { StoreObj } from '~/types'
import { getFileIcon } from '~/utils/icon'
import { getFileSize, formatDate } from '~/utils/str'
import { Check, MoreVertical, Download } from 'lucide-react'
import { useDownload } from '~/hooks/useDownload'
import { useObjStore } from '~/store/useObjStore'
import { useT } from '~/lang'
import { ThumbnailImage } from '~/components/ui/ThumbnailImage'

interface GridItemProps {
  obj: StoreObj
  index: number
  onOpen: (obj: StoreObj) => void
  onSelect: (index: number, selected: boolean, e: React.MouseEvent) => void
  onContextMenu: (e: React.MouseEvent, obj: StoreObj) => void
  onTouchStartItem?: (index: number, e: React.TouchEvent) => void
  hasJustFinishedDrag?: () => boolean
}

export const GridItem: React.FC<GridItemProps> = ({
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
  const { downloadObj } = useDownload()
  const t = useT()

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
      className={`viselect-item group relative flex flex-col justify-between overflow-hidden rounded-xl sm:rounded-2xl border p-2.5 sm:p-3.5 transition-all duration-200 cursor-pointer select-none active:scale-[0.98] ${
        isSelected
          ? 'border-indigo-500 bg-indigo-50/60 shadow-md ring-2 ring-indigo-500/20 dark:border-indigo-500 dark:bg-indigo-950/40'
          : 'border-slate-200/80 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800/80 dark:bg-slate-900 dark:hover:border-slate-700'
      }`}
    >
      {/* Top row: Checkbox, Quick Download, and Quick Menu */}
      <div className="flex items-center justify-between pb-1 sm:pb-2">
        <button
          onClick={handleCheckboxClick}
          className={`flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded sm:rounded-lg border transition-all ${
            isSelected
              ? 'border-indigo-600 bg-indigo-600 text-white'
              : hasSelection
              ? 'border-slate-300 bg-slate-50 opacity-100 dark:border-slate-600 dark:bg-slate-800'
              : 'border-slate-300 bg-slate-50 opacity-0 group-hover:opacity-100 dark:border-slate-600 dark:bg-slate-800'
          }`}
        >
          {isSelected && <Check className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5 stroke-[3]" />}
        </button>

        <div className="flex items-center space-x-0.5 sm:space-x-1">
          {!obj.is_dir && (
            <button
              onClick={handleQuickDownload}
              title={t('home.preview.download') || 'Download'}
              className="rounded-lg p-0.5 sm:p-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 dark:hover:text-indigo-400 transition-all"
            >
              <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation()
              onContextMenu(e, obj)
            }}
            className="rounded-lg p-0.5 sm:p-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-all"
          >
            <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
        </div>
      </div>

      {/* Middle: Icon or Thumbnail */}
      <div className="flex h-16 sm:h-24 items-center justify-center py-1 sm:py-2">
        {obj.thumb ? (
          <ThumbnailImage
            src={obj.thumb}
            alt={obj.name}
            className="max-h-full max-w-full rounded-lg object-contain shadow-xs"
            fallbackIcon={
              <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-slate-50 shadow-inner dark:bg-slate-800/60">
                {getFileIcon(obj, 'w-6 h-6 sm:w-9 sm:h-9')}
              </div>
            }
          />
        ) : (
          <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-slate-50 shadow-inner dark:bg-slate-800/60">
            {getFileIcon(obj, 'w-6 h-6 sm:w-9 sm:h-9')}
          </div>
        )}
      </div>

      {/* Bottom: Name & Size */}
      <div className="pt-1.5 sm:pt-2">
        <div
          title={obj.name}
          className="truncate text-[11px] sm:text-xs font-semibold text-slate-800 dark:text-slate-200"
        >
          {obj.name}
        </div>
        <div className="mt-0.5 sm:mt-1 flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400">
          <span className="truncate mr-1.5 sm:mr-2">
            {obj.is_dir
              ? (obj.mount_details?.total_space ?? 0) > 0
                ? `${getFileSize(obj.mount_details?.used_space ?? 0)} / ${getFileSize(obj.mount_details?.total_space ?? 0)}`
                : (obj.mount_details?.used_space ?? 0) > 0
                  ? getFileSize(obj.mount_details?.used_space ?? 0)
                  : t('home.search.scopes.folder') || 'Folder'
              : getFileSize(obj.size)}
          </span>
          <span className="shrink-0">{formatDate(obj.modified).slice(5, 10)}</span>
        </div>
      </div>
    </div>
  )
}
