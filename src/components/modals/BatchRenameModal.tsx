import React, { useState } from 'react'
import { X, Edit3, Loader2, Play } from 'lucide-react'
import { fsBatchRename } from '~/utils/api'
import { useObjStore } from '~/store/useObjStore'
import { notify } from '~/utils/notify'
import { Obj } from '~/types'
import { useT } from '~/lang'

interface BatchRenameModalProps {
  targets: Obj[]
  isOpen: boolean
  onClose: () => void
}

export const BatchRenameModal: React.FC<BatchRenameModalProps> = ({
  targets,
  isOpen,
  onClose,
}) => {
  const { currentPath, fetchPath, clearSelection } = useObjStore()
  const [searchPattern, setSearchPattern] = useState('')
  const [replacement, setReplacement] = useState('')
  const [isRegex, setIsRegex] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const t = useT()

  if (!isOpen || targets.length === 0) return null

  // Calculate live preview of renamed files
  const previews = targets.map((item) => {
    let newName = item.name
    if (searchPattern) {
      try {
        if (isRegex) {
          const reg = new RegExp(searchPattern, 'g')
          newName = item.name.replace(reg, replacement)
        } else {
          newName = item.name.split(searchPattern).join(replacement)
        }
      } catch (e) {
        // Invalid regex
      }
    }
    return { original: item.name, newName }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchPattern) {
      notify.error(t('global.empty_input') || 'Please specify search pattern')
      return
    }

    setSubmitting(true)
    const renameList = previews.map((p) => ({
      src_name: p.original,
      new_name: p.newName,
    }))

    try {
      const resp = await fsBatchRename(currentPath, renameList)
      if (resp.code === 200) {
        notify.success(t('global.save_success') || `Batch renamed ${targets.length} items`)
        clearSelection()
        onClose()
        fetchPath(currentPath, '', true)
      } else {
        notify.error(resp.message || 'Batch rename failed')
      }
    } catch (e: any) {
      notify.error(e.message || 'Batch rename failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex max-h-[85vh] w-full max-w-xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <Edit3 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t('home.toolbar.batch_rename') || 'Batch Rename'} ({targets.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('home.toolbar.find_replace_desc') || 'Pattern matching & string replacement'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {t('home.toolbar.find_replace') || 'Find / Match'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={searchPattern}
                onChange={(e) => setSearchPattern(e.target.value)}
                placeholder="String or regex"
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {t('home.toolbar.input_new_name') || 'Replace With'}
              </label>
              <input
                type="text"
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
                placeholder="Replacement string"
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isRegex"
              checked={isRegex}
              onChange={(e) => setIsRegex(e.target.checked)}
              className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="isRegex" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              {t('home.toolbar.regex_rename') || 'Regular Expression (RegExp) mode'}
            </label>
          </div>

          {/* Real-time Preview Table */}
          <div className="space-y-1.5 pt-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {t('home.toolbar.regex_rename_preview') || 'Live Preview'}
            </span>
            <div className="max-h-48 overflow-y-auto rounded-2xl border border-slate-200/80 bg-slate-50 p-2 text-xs dark:border-slate-800 dark:bg-slate-950">
              {previews.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between p-1.5 font-mono text-[11px] border-b border-slate-200/60 dark:border-slate-800 last:border-0">
                  <span className="text-slate-400 truncate max-w-[45%]">{p.original}</span>
                  <span className="text-slate-400">→</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold truncate max-w-[45%]">
                    {p.newName}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Submit */}
          <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {t('global.cancel') || 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-500/20 hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              <span>{t('global.confirm') || 'Apply'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
