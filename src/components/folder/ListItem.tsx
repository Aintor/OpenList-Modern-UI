import React from 'react'
import { StoreObj } from '~/types'
import { getFileIcon } from '~/utils/icon'
import { getFileSize, formatDate } from '~/utils/str'
import { Check, Download } from 'lucide-react'
import { useDownload } from '~/hooks/useDownload'
import { useObjStore } from '~/store/useObjStore'
import { useT } from '~/lang'

interface ListItemProps {
  obj: StoreObj
  index: number
  onOpen: (obj: StoreObj) => void
  onSelect: (index: number, selected: boolean, e: React.MouseEvent) => void
  onContextMenu: (e: React.MouseEvent, obj: StoreObj) => void
}

export const ListItem: React.FC<ListItemProps> = ({
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
      className={`viselect-item group flex items-center justify-between rounded-xl px-3 py-2.5 transition-all duration-150 cursor-pointer select-none ${
        isSelected
          ? 'bg-indigo-50/80 text-indigo-900 ring-1 ring-indigo-500/30 dark:bg-indigo-950/50 dark:text-indigo-200'
          : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
      }`}
    >
      {/* Left: Checkbox + Icon + Name */}
      <div className="flex items-center space-x-3 overflow-hidden flex-1 mr-4">
        <button
          onClick={handleCheckboxClick}
          className={`flex h-4 w-4 items-center justify-center rounded border transition-all shrink-0 ${
            isSelected
              ? 'border-indigo-600 bg-indigo-600 text-white'
              : 'border-slate-300 bg-white opacity-0 group-hover:opacity-100 dark:border-slate-600 dark:bg-slate-800'
          }`}
        >
          {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
        </button>

        <div className="shrink-0">{getFileIcon(obj, 'w-5 h-5')}</div>

        <span
          title={obj.name}
          className={`truncate text-sm font-medium ${
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
          className="mr-2 rounded-lg p-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 dark:hover:text-indigo-400 transition-all shrink-0"
        >
          <Download className="h-4 w-4" />
        </button>
      )}

      {/* Center: Mount disk space or Size */}
      <div className="w-28 text-right text-xs text-slate-500 dark:text-slate-400 shrink-0">
        {obj.is_dir ? '—' : getFileSize(obj.size)}
      </div>

      {/* Right: Modified Date */}
      <div className="hidden sm:block w-36 text-right text-xs text-slate-400 dark:text-slate-500 shrink-0">
        {formatDate(obj.modified)}
      </div>
    </div>
  )
}
