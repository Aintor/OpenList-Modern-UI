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
}

export const GridItem: React.FC<GridItemProps> = ({
  obj,
  index,
  onOpen,
  onSelect,
  onContextMenu,
}) => {
  const isSelected = !!obj.selected
  const hasSelection = useObjStore((state) => state.objs.some((o) => o.selected))
  const { downloadObj } = useDownload()
  const t = useT()

  const handleClick = (e: React.MouseEvent) => {
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
      onContextMenu={(e) => onContextMenu(e, obj)}
      className={`viselect-item group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-3.5 transition-all duration-200 cursor-pointer select-none ${
        isSelected
          ? 'border-indigo-500 bg-indigo-50/60 shadow-md ring-2 ring-indigo-500/20 dark:border-indigo-500 dark:bg-indigo-950/40'
          : 'border-slate-200/80 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800/80 dark:bg-slate-900 dark:hover:border-slate-700'
      }`}
    >
      {/* Top row: Checkbox, Quick Download, and Quick Menu */}
      <div className="flex items-center justify-between pb-2">
        <button
          onClick={handleCheckboxClick}
          className={`flex h-5 w-5 items-center justify-center rounded-lg border transition-all ${
            isSelected
              ? 'border-indigo-600 bg-indigo-600 text-white'
              : 'border-slate-300 bg-slate-50 opacity-0 group-hover:opacity-100 dark:border-slate-600 dark:bg-slate-800'
          }`}
        >
          {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
        </button>

        <div className="flex items-center space-x-1">
          {!obj.is_dir && (
            <button
              onClick={handleQuickDownload}
              title={t('home.preview.download') || 'Download'}
              className="rounded-lg p-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 dark:hover:text-indigo-400 transition-all"
            >
              <Download className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation()
              onContextMenu(e, obj)
            }}
            className="rounded-lg p-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-all"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Middle: Icon or Thumbnail */}
      <div className="flex h-24 items-center justify-center py-2">
        {obj.thumb ? (
          <ThumbnailImage
            src={obj.thumb}
            alt={obj.name}
            className="max-h-full max-w-full rounded-lg object-contain shadow-xs"
            fallbackIcon={
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 shadow-inner dark:bg-slate-800/60">
                {getFileIcon(obj, 'w-9 h-9')}
              </div>
            }
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 shadow-inner dark:bg-slate-800/60">
            {getFileIcon(obj, 'w-9 h-9')}
          </div>
        )}
      </div>

      {/* Bottom: Name & Size */}
      <div className="pt-2">
        <div
          title={obj.name}
          className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200"
        >
          {obj.name}
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
          <span>{obj.is_dir ? (t('home.search.scopes.folder') || 'Folder') : getFileSize(obj.size)}</span>
          <span>{formatDate(obj.modified).slice(5, 10)}</span>
        </div>
      </div>
    </div>
  )
}
