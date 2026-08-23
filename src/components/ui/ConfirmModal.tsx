import React from 'react'
import { AlertTriangle, Trash2, Loader2, X } from 'lucide-react'
import { useT } from '~/lang'

export interface ConfirmModalProps {
  isOpen: boolean
  title?: string
  description: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  loading?: boolean
  onClose: () => void
  onConfirm: () => void
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  description,
  confirmText,
  cancelText,
  danger = true,
  loading = false,
  onClose,
  onConfirm,
}) => {
  const t = useT()

  if (!isOpen) return null

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute right-4 top-4 rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start space-x-3.5 mb-5">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
              danger
                ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400'
            }`}
          >
            {danger ? <AlertTriangle className="h-5 w-5" /> : <Trash2 className="h-5 w-5" />}
          </div>
          <div className="pr-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {title || (danger ? t('global.delete') || '确认删除' : t('global.confirm') || '确认操作')}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed break-words">
              {description}
            </p>
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {cancelText || t('global.cancel') || '取消'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex items-center space-x-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer ${
              danger
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
            }`}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : danger ? (
              <Trash2 className="h-3.5 w-3.5" />
            ) : null}
            <span>{confirmText || (danger ? t('global.delete') || '删除' : t('global.confirm') || '确定')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
