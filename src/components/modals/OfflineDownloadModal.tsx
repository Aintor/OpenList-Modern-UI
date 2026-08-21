import React, { useState } from 'react'
import { X, DownloadCloud, Loader2, Play } from 'lucide-react'
import { offlineDownload } from '~/utils/api'
import { useObjStore } from '~/store/useObjStore'
import { notify } from '~/utils/notify'
import { useT } from '~/lang'
import { CustomSelect } from '~/components/ui/CustomSelect'

interface OfflineDownloadModalProps {
  isOpen: boolean
  onClose: () => void
}

export const OfflineDownloadModal: React.FC<OfflineDownloadModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentPath } = useObjStore()
  const [urls, setUrls] = useState('')
  const [tool, setTool] = useState('aria2')
  const [submitting, setSubmitting] = useState(false)
  const t = useT()

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const urlList = urls
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean)

    if (urlList.length === 0) {
      notify.error(t('global.empty_input') || 'Please enter at least one URL')
      return
    }

    setSubmitting(true)
    try {
      const resp = await offlineDownload(currentPath, urlList, tool)
      if (resp.code === 200) {
        notify.success(t('global.save_success') || `Added ${urlList.length} offline download tasks`)
        setUrls('')
        onClose()
      } else {
        notify.error(resp.message || 'Offline download failed')
      }
    } catch (e: any) {
      notify.error(e.message || 'Action failed')
    } finally {
      setSubmitting(false)
    }
  }

  const toolOptions = [
    { value: 'aria2', label: 'Aria2 RPC' },
    { value: 'qBittorrent', label: 'qBittorrent' },
    { value: 'Transmission', label: 'Transmission' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-5 flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
            <DownloadCloud className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {t('home.toolbar.offline_download') || 'Offline Download'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('home.toolbar.offline_download_enhanced.files_count') ? `目标目录: ${currentPath}` : `Save to: ${currentPath}`}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('home.toolbar.offline_download_enhanced.files_count') ? '下载链接 (支持 HTTP / HTTPS / Magnet / ed2k，每行一个)' : 'Download URLs (HTTP / HTTPS / Magnet / ed2k, one per line)'}
            </label>
            <textarea
              rows={5}
              required
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder="https://example.com/file.iso&#10;magnet:?xt=urn:btih:..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 font-mono text-xs text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('home.toolbar.offline_download_enhanced.files_count') ? '离线下载工具' : 'Download Engine'}
            </label>
            <CustomSelect
              value={tool}
              onChange={(val) => setTool(val)}
              options={toolOptions}
              className="w-full"
              triggerClassName="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
            >
              {t('global.cancel') || 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              <span>{t('indexes.start') || 'Start Download'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
