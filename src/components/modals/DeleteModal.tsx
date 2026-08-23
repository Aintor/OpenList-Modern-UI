import React, { useState } from 'react'
import { X, Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { fsRemove } from '~/utils/api'
import { useObjStore } from '~/store/useObjStore'
import { notify } from '~/utils/notify'
import { Obj } from '~/types'
import { useT } from '~/lang'
import { getFileIcon } from '~/utils/icon'
import { getFileSize } from '~/utils/str'

interface DeleteModalProps {
  targets: Obj[]
  isOpen: boolean
  onClose: () => void
}

export const DeleteModal: React.FC<DeleteModalProps> = ({ targets, isOpen, onClose }) => {
  const [loading, setLoading] = useState(false)
  const { currentPath, fetchPath, clearSelection } = useObjStore()
  const t = useT()

  if (!isOpen || targets.length === 0) return null

  const handleDelete = async () => {
    setLoading(true)
    const names = targets.map((t) => t.name)
    try {
      const resp = await fsRemove(currentPath, names)
      if (resp.code === 200) {
        notify.success(t('global.delete_success') || 'Deleted successfully')
        clearSelection()
        onClose()
        fetchPath(currentPath, '', true)
      } else {
        notify.error(resp.message || 'Delete failed')
      }
    } catch (err: any) {
      notify.error(err.message || 'Delete failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-5 flex items-center space-x-3 pr-8">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
              {t('home.toolbar.delete') || 'Delete Items'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {t('home.toolbar.delete-tips') || 'Are you sure you want to delete the selected items?'}
            </p>
          </div>
        </div>

        {/* Selected List */}
        <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/80 p-2 dark:border-slate-800/80 dark:bg-slate-800/40 mb-4 space-y-1.5">
          {targets.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between space-x-2 rounded-lg bg-white/80 px-2.5 py-1.5 text-xs shadow-xs dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50"
            >
              <div className="flex items-center space-x-2 overflow-hidden flex-1 min-w-0">
                <span className="shrink-0">{getFileIcon(item, 'w-4 h-4')}</span>
                <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                  {item.name}
                </span>
              </div>
              {!item.is_dir && item.size > 0 && (
                <span className="shrink-0 font-mono text-[10px] text-slate-400">
                  {getFileSize(item.size)}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
          >
            {t('global.cancel') || 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="flex items-center rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-rose-500/20 hover:bg-rose-700 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
            <span>{t('global.confirm') || 'Delete'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
