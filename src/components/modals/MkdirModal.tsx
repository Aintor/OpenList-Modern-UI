import React, { useState } from 'react'
import { X, FolderPlus, Loader2 } from 'lucide-react'
import { fsMkdir } from '~/utils/api'
import { useObjStore } from '~/store/useObjStore'
import { notify } from '~/utils/notify'
import { SmartPath } from '~/components/ui/SmartPath'
import { validateFilename } from '~/utils/str'
import { useT } from '~/lang'

interface MkdirModalProps {
  isOpen: boolean
  onClose: () => void
}

export const MkdirModal: React.FC<MkdirModalProps> = ({ isOpen, onClose }) => {
  const [folderName, setFolderName] = useState('')
  const [loading, setLoading] = useState(false)
  const { currentPath, fetchPath } = useObjStore()
  const t = useT()

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const isRoot = currentPath === '/' || currentPath === ''
    const { valid, error } = validateFilename(folderName, isRoot)
    if (!valid) {
      const errorMsg = error ? t(`global.${error}`) || error : t('global.invalid_filename_chars')
      notify.error(errorMsg || 'Invalid folder name')
      return
    }

    setLoading(true)
    const targetPath = (currentPath.endsWith('/') ? currentPath : currentPath + '/') + folderName
    try {
      const resp = await fsMkdir(targetPath)
      if (resp.code === 200) {
        notify.success(t('global.save_success') || 'Folder created successfully')
        setFolderName('')
        onClose()
        fetchPath(currentPath, '', true)
      } else {
        notify.error(resp.message || 'Failed to create folder')
      }
    } catch (err: any) {
      notify.error(err.message || 'Failed to create folder')
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
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
            <FolderPlus className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
              {t('home.toolbar.mkdir') || 'Create New Folder'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              <SmartPath path={currentPath} />
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              autoFocus
              required
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder={t('home.toolbar.input_dir_name') || 'Folder Name'}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-base sm:text-sm transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:focus:bg-slate-900"
            />
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
              type="submit"
              disabled={loading}
              className="flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-500/20 hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              <span>{t('global.confirm') || 'Create Folder'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
