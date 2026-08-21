import React, { useEffect, useRef } from 'react'
import {
  FolderOpen,
  Eye,
  Download,
  Copy,
  FolderInput,
  FolderOutput,
  Edit2,
  Trash2,
  Share2,
  CheckSquare,
  Archive,
} from 'lucide-react'
import { StoreObj } from '~/types'
import { useT } from '~/lang'
import { useDownload } from '~/hooks/useDownload'
import { useObjStore } from '~/store/useObjStore'
import { copyDirectLink } from '~/utils/link'

interface ContextMenuProps {
  obj: StoreObj | null
  objs?: StoreObj[]
  position: { x: number; y: number } | null
  onClose: () => void
  onOpen: (obj: StoreObj) => void
  onRename: (obj: StoreObj) => void
  onBatchRename?: (objs: StoreObj[]) => void
  onDelete: (objs: StoreObj[]) => void
  onShare: (obj: StoreObj) => void
  onCopyMove: (objs: StoreObj[], action: 'copy' | 'move') => void
  onPackageDownload?: (objs: StoreObj[]) => void
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  obj,
  objs = [],
  position,
  onClose,
  onOpen,
  onRename,
  onBatchRename,
  onDelete,
  onShare,
  onCopyMove,
  onPackageDownload,
}) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const t = useT()
  const { downloadObj, batchDownload } = useDownload()
  const { currentPath, write } = useObjStore()

  const isShare = currentPath.startsWith('/@s') || currentPath.startsWith('/@share')
  const isMultiple = objs.length > 1
  const targets = isMultiple ? objs : (obj ? [obj] : [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleScroll = () => onClose()

    window.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [onClose])

  if (!position || targets.length === 0) return null

  // Ensure menu stays within viewport bounds
  const x = Math.min(position.x, window.innerWidth - 220)
  const y = Math.min(position.y, window.innerHeight - 420)

  const handleCopyLink = async () => {
    if (obj && !obj.is_dir) {
      await copyDirectLink(obj, currentPath, t)
    }
    onClose()
  }

  const handleDownload = () => {
    if (isMultiple) {
      batchDownload(targets)
    } else if (obj && !obj.is_dir) {
      downloadObj(obj)
    }
    onClose()
  }

  const handlePackageDownload = () => {
    if (onPackageDownload) {
      onPackageDownload(targets)
    }
    onClose()
  }

  const hasDir = targets.some((o) => o.is_dir)

  return (
    <div
      ref={menuRef}
      style={{ top: `${y}px`, left: `${x}px` }}
      className="fixed z-50 w-52 rounded-2xl border border-slate-200/80 bg-white/95 p-1.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 dark:border-slate-800 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200"
    >
      {/* Header showing Single Item name or Multi-Select count */}
      <div className="px-2.5 py-1.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 truncate border-b border-slate-100 dark:border-slate-800 mb-1 flex items-center justify-between">
        {isMultiple ? (
          <span className="flex items-center space-x-1.5 text-indigo-600 dark:text-indigo-400 font-semibold">
            <CheckSquare className="h-3.5 w-3.5" />
            <span>{targets.length} {t('home.toolbar.offline_download_enhanced.files_count') ? '个已选项目' : 'items selected'}</span>
          </span>
        ) : (
          <span className="truncate">{obj?.name}</span>
        )}
      </div>

      {/* Single Item: Open/Preview */}
      {!isMultiple && obj && (
        <button
          onClick={() => {
            onOpen(obj)
            onClose()
          }}
          className="flex w-full items-center space-x-2 rounded-xl px-2.5 py-1.5 text-xs font-medium hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-400 transition-colors cursor-pointer"
        >
          {obj.is_dir ? <FolderOpen className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          <span>{obj.is_dir ? (t('home.toolbar.mkdir') ? '打开文件夹' : 'Open') : (t('home.toolbar.preview_page') || 'Preview')}</span>
        </button>
      )}

      {/* Download (Single File or Batch Files) */}
      {(!isMultiple ? !obj?.is_dir : true) && (
        <button
          onClick={handleDownload}
          className="flex w-full items-center space-x-2 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" />
          <span>{isMultiple ? (t('home.toolbar.batch_download') || 'Batch Download') : (t('home.preview.download') || 'Download')}</span>
        </button>
      )}

      {/* Package Download (.zip) for folder or multiple items */}
      {(hasDir || isMultiple) && onPackageDownload && (
        <button
          onClick={handlePackageDownload}
          className="flex w-full items-center space-x-2 rounded-xl px-2.5 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/60 transition-colors cursor-pointer"
        >
          <Archive className="h-3.5 w-3.5" />
          <span>{t('home.toolbar.package_download') || '打包下载 (.zip)'}</span>
        </button>
      )}

      {/* Single Item: Copy Direct Link */}
      {!isMultiple && obj && !obj.is_dir && (
        <button
          onClick={handleCopyLink}
          className="flex w-full items-center space-x-2 rounded-xl px-2.5 py-1.5 text-xs font-medium hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors cursor-pointer"
        >
          <Copy className="h-3.5 w-3.5" />
          <span>{t('home.toolbar.copy_link') || 'Copy Direct Link'}</span>
        </button>
      )}

      {/* Single Item: Share */}
      {!isMultiple && obj && !isShare && (
        <button
          onClick={() => {
            onShare(obj)
            onClose()
          }}
          className="flex w-full items-center space-x-2 rounded-xl px-2.5 py-1.5 text-xs font-medium hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors cursor-pointer"
        >
          <Share2 className="h-3.5 w-3.5" />
          <span>{t('home.toolbar.share') || 'Share'}</span>
        </button>
      )}

      {write && (
        <>
          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

          {/* Copy to... */}
          <button
            onClick={() => {
              onCopyMove(targets, 'copy')
              onClose()
            }}
            className="flex w-full items-center space-x-2 rounded-xl px-2.5 py-1.5 text-xs font-medium hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors cursor-pointer"
          >
            <FolderOutput className="h-3.5 w-3.5" />
            <span>{isMultiple ? (t('home.toolbar.batch_copy') ? `复制 ${targets.length} 项到...` : `Copy ${targets.length} items to...`) : (t('home.toolbar.copy') || 'Copy to...')}</span>
          </button>

          {/* Move to... */}
          <button
            onClick={() => {
              onCopyMove(targets, 'move')
              onClose()
            }}
            className="flex w-full items-center space-x-2 rounded-xl px-2.5 py-1.5 text-xs font-medium hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors cursor-pointer"
          >
            <FolderInput className="h-3.5 w-3.5" />
            <span>{isMultiple ? (t('home.toolbar.batch_move') ? `移动 ${targets.length} 项到...` : `Move ${targets.length} items to...`) : (t('home.toolbar.move') || 'Move to...')}</span>
          </button>

          {/* Rename (Single) / Batch Rename (Multiple) */}
          {isMultiple ? (
            onBatchRename && (
              <button
                onClick={() => {
                  onBatchRename(targets)
                  onClose()
                }}
                className="flex w-full items-center space-x-2 rounded-xl px-2.5 py-1.5 text-xs font-medium hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors cursor-pointer"
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span>{t('home.toolbar.batch_rename') || 'Batch Rename'}</span>
              </button>
            )
          ) : (
            obj && (
              <button
                onClick={() => {
                  onRename(obj)
                  onClose()
                }}
                className="flex w-full items-center space-x-2 rounded-xl px-2.5 py-1.5 text-xs font-medium hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors cursor-pointer"
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span>{t('home.toolbar.rename') || 'Rename'}</span>
              </button>
            )
          )}

          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

          {/* Delete (Single or Batch) */}
          <button
            onClick={() => {
              onDelete(targets)
              onClose()
            }}
            className="flex w-full items-center space-x-2 rounded-xl px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{isMultiple ? (t('home.toolbar.batch_delete') ? `删除已选 (${targets.length})` : `Delete (${targets.length})`) : (t('home.toolbar.delete') || 'Delete')}</span>
          </button>
        </>
      )}
    </div>
  )
}
