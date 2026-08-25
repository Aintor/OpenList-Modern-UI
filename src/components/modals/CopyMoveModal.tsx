import React, { useEffect, useState } from 'react'
import {
  X,
  Folder,
  FolderInput,
  FolderOutput,
  ChevronRight,
  ArrowLeft,
  Loader2,
} from 'lucide-react'
import { r } from '~/utils/request'
import { Obj, StoreObj, Resp } from '~/types'
import { notify } from '~/utils/notify'
import { useObjStore } from '~/store/useObjStore'
import { SmartPath } from '~/components/ui/SmartPath'
import { useT } from '~/lang'
import { useAudioPlayerStore } from '~/store/useAudioPlayerStore'

interface CopyMoveModalProps {
  targets: Obj[]
  action: 'copy' | 'move'
  isOpen: boolean
  onClose: () => void
}

export const CopyMoveModal: React.FC<CopyMoveModalProps> = ({
  targets,
  action,
  isOpen,
  onClose,
}) => {
  const t = useT()
  const { currentPath, fetchPath } = useObjStore()
  const [destPath, setDestPath] = useState(currentPath)
  const [folders, setFolders] = useState<StoreObj[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Fetch folders in destination path
  const fetchFoldersInPath = async (path: string) => {
    setLoading(true)
    try {
      const resp: Resp<{ content: StoreObj[] }> = await r.post('/fs/list', {
        path,
        password: '',
        page: 1,
        per_page: 0,
        refresh: false,
      })

      if (resp.code === 200 && resp.data) {
        const onlyDirs = (resp.data.content || []).filter((item) => item.is_dir)
        setFolders(onlyDirs)
      } else {
        setFolders([])
      }
    } catch (e) {
      setFolders([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      setDestPath(currentPath)
      fetchFoldersInPath(currentPath)
    }
  }, [isOpen, currentPath])

  if (!isOpen || targets.length === 0) return null

  const handleEnterFolder = (name: string) => {
    const newPath = (destPath.endsWith('/') ? destPath : destPath + '/') + name
    setDestPath(newPath)
    fetchFoldersInPath(newPath)
  }

  const handleGoUp = () => {
    if (destPath === '/' || !destPath) return
    const parts = destPath.split('/').filter(Boolean)
    parts.pop()
    const parent = '/' + parts.join('/')
    setDestPath(parent)
    fetchFoldersInPath(parent)
  }

  const handleExecute = async () => {
    setSubmitting(true)
    const srcDir = currentPath
    const names = targets.map((t) => t.name)

    try {
      const endpoint = action === 'copy' ? '/fs/copy' : '/fs/move'
      const resp: Resp<any> = await r.post(endpoint, {
        src_dir: srcDir,
        dst_dir: destPath,
        names,
      })

      if (resp.code === 200) {
        notify.success(
          action === 'copy'
            ? `${names.length} item(s) copied`
            : `${names.length} item(s) moved`
        )
        if (action === 'move') {
          useAudioPlayerStore.getState().moveTracks(srcDir, destPath, names)
        }
        fetchPath(currentPath)
        onClose()
      } else {
        notify.error(resp.message || 'Operation failed')
      }
    } catch (err: any) {
      notify.error(err.message || 'Operation failed')
    } finally {
      setSubmitting(false)
    }
  }

  const isCopy = action === 'copy'
  const Icon = isCopy ? FolderOutput : FolderInput

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden transition-all dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                isCopy
                  ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400'
                  : 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
              }`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isCopy ? (t('home.toolbar.copy') || 'Copy to...') : (t('home.toolbar.move') || 'Move to...')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {targets.length} {targets.length === 1 ? 'item selected' : 'items selected'}
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

        {/* Current Destination Bar */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-2.5 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex items-center space-x-2 overflow-hidden flex-1 min-w-0">
            <button
              onClick={handleGoUp}
              disabled={destPath === '/'}
              className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <SmartPath path={destPath} className="text-xs font-mono font-semibold" />
            </div>
          </div>
        </div>

        {/* Directory Navigator Body */}
        <div className="flex-1 overflow-y-auto p-4 min-h-[220px] max-h-[350px]">
          {loading ? (
            <div className="flex h-40 items-center justify-center space-x-2 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
              <span className="text-xs">{t('global.loading') || 'Loading folders...'}</span>
            </div>
          ) : folders.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center space-y-1 text-slate-400">
              <Folder className="h-8 w-8 stroke-[1.5]" />
              <span className="text-xs">{t('global.empty') || 'No subfolders in this directory'}</span>
            </div>
          ) : (
            <div className="space-y-1">
              {folders.map((f) => (
                <button
                  key={f.name}
                  onClick={() => handleEnterFolder(f.name)}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60 transition-colors group"
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <Folder className="h-4 w-4 text-indigo-500" />
                    <span className="truncate">{f.name}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 dark:text-slate-600" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
          >
            {t('global.cancel') || 'Cancel'}
          </button>

          <button
            onClick={handleExecute}
            disabled={submitting}
            className={`flex items-center space-x-1.5 rounded-xl px-5 py-2 text-xs font-semibold text-white shadow-sm transition-all active:scale-95 disabled:opacity-50 ${
              isCopy
                ? 'bg-indigo-600 shadow-indigo-500/20 hover:bg-indigo-700'
                : 'bg-amber-600 shadow-amber-500/20 hover:bg-amber-700'
            }`}
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Icon className="h-3.5 w-3.5" />
            )}
            <span>
              {isCopy
                ? (t('home.toolbar.copy') ? '复制到此处' : 'Copy Here')
                : (t('home.toolbar.move') ? '移动到此处' : 'Move Here')}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
