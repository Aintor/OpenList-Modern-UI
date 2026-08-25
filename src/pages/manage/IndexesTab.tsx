import React, { useEffect, useState } from 'react'
import { r } from '~/utils/request'
import { notify } from '~/utils/notify'
import { useT } from '~/lang'
import { formatDate } from '~/utils/str'
import {
  Search,
  RefreshCw,
  Play,
  Square,
  Trash2,
  Edit3,
  Loader2,
  CheckCircle2,
  Clock,
  Database,
  Radar,
  AlertTriangle,
  X,
  Save,
} from 'lucide-react'

interface IndexProgress {
  obj_count: number
  is_done: boolean
  last_done_time: string
  error?: string
}

interface ScanProgress {
  obj_count: number
  is_done: boolean
}

export const IndexesTab: React.FC = () => {
  const t = useT()

  // 1. Index progress state
  const [indexProgress, setIndexProgress] = useState<IndexProgress | null>(null)
  const [building, setBuilding] = useState(false)

  // 2. Scan progress & inputs state
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null)
  const [scanPath, setScanPath] = useState('/')
  const [rateLimit, setRateLimit] = useState('0')
  const [scanning, setScanning] = useState(false)

  // 3. Update modal state
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)
  const [updatePaths, setUpdatePaths] = useState('/')
  const [maxDepth, setMaxDepth] = useState('20')
  const [updating, setUpdating] = useState(false)

  // Fetch Index Progress
  const fetchIndexProgress = async () => {
    try {
      const resp = await r.get<IndexProgress>('/admin/index/progress')
      if (resp.code === 200 && resp.data) {
        setIndexProgress(resp.data)
      }
    } catch (e) {
      // ignore
    }
  }

  // Fetch Scan Progress
  const fetchScanProgress = async () => {
    try {
      const resp = await r.get<ScanProgress>('/admin/scan/progress')
      if (resp.code === 200 && resp.data) {
        setScanProgress(resp.data)
      }
    } catch (e) {
      // ignore
    }
  }

  useEffect(() => {
    fetchIndexProgress()
    fetchScanProgress()

    // Poll periodically while building or scanning
    const timer = setInterval(() => {
      fetchIndexProgress()
      fetchScanProgress()
    }, 3000)

    return () => clearInterval(timer)
  }, [])

  // Actions for Index
  const handleBuildOrRebuild = async () => {
    setBuilding(true)
    try {
      const resp = await r.post('/admin/index/build')
      if (resp.code === 200) {
        notify.success(t('global.save_success') || 'Indexing task triggered')
        fetchIndexProgress()
      } else {
        notify.error(resp.message || 'Failed to start indexing')
      }
    } catch (e: any) {
      notify.error(e.message || 'Failed to start indexing')
    } finally {
      setBuilding(false)
    }
  }

  const handleStopIndex = async () => {
    try {
      const resp = await r.post('/admin/index/stop')
      if (resp.code === 200) {
        notify.success(t('global.save_success') || 'Indexing stopped')
        fetchIndexProgress()
      } else {
        notify.error(resp.message || 'Failed to stop')
      }
    } catch (e: any) {
      notify.error(e.message || 'Action failed')
    }
  }

  const handleClearIndex = async () => {
    if (!confirm(t('global.delete_confirm', { name: t('indexes.search_index') || 'Search Index' }) || 'Clear all search index data?')) return
    try {
      const resp = await r.post('/admin/index/clear')
      if (resp.code === 200) {
        notify.success(t('global.delete_success') || 'Search index cleared')
        fetchIndexProgress()
      } else {
        notify.error(resp.message || 'Failed to clear index')
      }
    } catch (e: any) {
      notify.error(e.message || 'Action failed')
    }
  }

  const handlePartialUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setUpdating(true)
    const paths = updatePaths.split('\n').map((p) => p.trim()).filter(Boolean)
    const depth = parseInt(maxDepth, 10) || 20

    try {
      const resp = await r.post('/admin/index/update', { paths, max_depth: depth })
      if (resp.code === 200) {
        notify.success(t('global.save_success') || 'Index update task started')
        setIsUpdateModalOpen(false)
        fetchIndexProgress()
      } else {
        notify.error(resp.message || 'Failed to update index')
      }
    } catch (e: any) {
      notify.error(e.message || 'Failed to update index')
    } finally {
      setUpdating(false)
    }
  }

  // Actions for Scan
  const handleStartScan = async (e: React.FormEvent) => {
    e.preventDefault()
    setScanning(true)
    try {
      const resp = await r.post('/admin/scan/start', {
        path: scanPath,
        limit: parseFloat(rateLimit) || 0,
      })
      if (resp.code === 200) {
        notify.success(t('global.save_success') || 'Scan task started')
        fetchScanProgress()
      } else {
        notify.error(resp.message || 'Failed to start scan')
      }
    } catch (e: any) {
      notify.error(e.message || 'Failed to start scan')
    } finally {
      setScanning(false)
    }
  }

  const handleStopScan = async () => {
    try {
      const resp = await r.post('/admin/scan/stop')
      if (resp.code === 200) {
        notify.success(t('global.save_success') || 'Scan stopped')
        fetchScanProgress()
      } else {
        notify.error(resp.message || 'Failed to stop scan')
      }
    } catch (e: any) {
      notify.error(e.message || 'Action failed')
    }
  }

  const isIndexingRunning = indexProgress ? !indexProgress.is_done : false
  const isScanRunning = scanProgress ? !scanProgress.is_done : false

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">
            {t('indexes.index_header') || 'Search Indexing & Scanner'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('indexes.index_header') ? '构建全局多盘目录索引缓存，实现秒级模糊搜索' : 'Build metadata indexes to enable instant fuzzy search across all mounted storages'}
          </p>
        </div>

        <button
          onClick={() => {
            fetchIndexProgress()
            fetchScanProgress()
          }}
          className="flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>{t('global.refresh') || 'Refresh'}</span>
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Section 1: Search Index Engine */}
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                  <Search className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {t('indexes.search_index') || 'Search Index'}
                  </h4>
                  <span
                    className={`inline-flex items-center space-x-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      isIndexingRunning
                        ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 animate-pulse'
                        : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                    }`}
                  >
                    {isIndexingRunning ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        <span>{t('indexes.running') || 'Running'}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        <span>{t('indexes.idle') || 'Idle / Ready'}</span>
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Metrics Info */}
            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-3.5 dark:bg-slate-800/50">
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-slate-400 flex items-center space-x-1">
                  <Database className="h-3.5 w-3.5 text-indigo-500" />
                  <span>{t('indexes.obj_count') || 'Indexed Objects'}</span>
                </div>
                <div className="text-base font-bold text-slate-800 dark:text-slate-200">
                  {indexProgress?.obj_count?.toLocaleString() ?? 0}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-medium text-slate-400 flex items-center space-x-1">
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                  <span>{t('indexes.last_done_time') || 'Last Updated'}</span>
                </div>
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                  {indexProgress?.last_done_time ? formatDate(indexProgress.last_done_time) : (t('indexes.unknown') || 'None')}
                </div>
              </div>
            </div>

            {indexProgress?.error && (
              <div className="flex items-start space-x-2 rounded-2xl bg-rose-50 p-3 text-xs text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="font-mono text-[11px] break-all">{indexProgress.error}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={handleBuildOrRebuild}
              disabled={building}
              className="flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
            >
              {building ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              <span>{t(indexProgress?.is_done ? 'indexes.rebuild' : 'indexes.build') || 'Build Index'}</span>
            </button>

            <button
              onClick={() => setIsUpdateModalOpen(true)}
              className="flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors"
            >
              <Edit3 className="h-3.5 w-3.5 text-slate-500" />
              <span>{t('indexes.update') || 'Update Paths'}</span>
            </button>

            {isIndexingRunning && (
              <button
                onClick={handleStopIndex}
                className="flex items-center space-x-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300 transition-colors"
              >
                <Square className="h-3.5 w-3.5" />
                <span>{t('indexes.stop') || 'Stop'}</span>
              </button>
            )}

            <button
              onClick={handleClearIndex}
              className="flex items-center space-x-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{t('indexes.clear') || 'Clear'}</span>
            </button>
          </div>
        </div>

        {/* Section 2: Directory Scanner */}
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-5">
          <form onSubmit={handleStartScan} className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
                  <Radar className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {t('indexes.scan_header') || 'Manual Directory Scan'}
                  </h4>
                  <span
                    className={`inline-flex items-center space-x-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      isScanRunning
                        ? 'bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400 animate-pulse'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {isScanRunning ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        <span>{t('indexes.running') || 'Scanning'}</span>
                      </>
                    ) : (
                      <span>{t('indexes.idle') || 'Standby'}</span>
                    )}
                  </span>
                </div>
              </div>

              {scanProgress && (
                <div className="text-right">
                  <span className="text-[11px] text-slate-400">{t('indexes.obj_count') || 'Count'}: </span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {scanProgress.obj_count?.toLocaleString() ?? 0}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t('indexes.path_to_scan') || 'Path to Scan'}
                </label>
                <input
                  type="text"
                  required
                  value={scanPath}
                  onChange={(e) => setScanPath(e.target.value)}
                  placeholder="/"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-base sm:text-xs text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t('indexes.rate_limit') || 'Rate Limit (Requests/s, 0 for unlimited)'}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={rateLimit}
                  onChange={(e) => setRateLimit(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-base sm:text-xs text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="submit"
                disabled={scanning || isScanRunning}
                className="flex items-center space-x-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sky-700 active:scale-95 transition-all disabled:opacity-50"
              >
                {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                <span>{t('indexes.start') || 'Start Scan'}</span>
              </button>

              {isScanRunning && (
                <button
                  type="button"
                  onClick={handleStopScan}
                  className="flex items-center space-x-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400 transition-colors"
                >
                  <Square className="h-3.5 w-3.5" />
                  <span>{t('indexes.stop') || 'Stop Scan'}</span>
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Partial Update Modal */}
      {isUpdateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative flex w-full max-w-lg flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                  <Edit3 className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('indexes.update') || 'Update Specific Index Paths'}
                </h3>
              </div>
              <button
                onClick={() => setIsUpdateModalOpen(false)}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handlePartialUpdate} className="space-y-4 pt-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t('indexes.paths_to_update') || 'Paths (One per line)'}
                </label>
                <textarea
                  rows={4}
                  required
                  value={updatePaths}
                  onChange={(e) => setUpdatePaths(e.target.value)}
                  placeholder="/folder1&#10;/folder2/subfolder"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-base sm:text-xs font-mono text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t('indexes.max_depth') || 'Max Depth'}
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={maxDepth}
                  onChange={(e) => setMaxDepth(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-base sm:text-xs text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsUpdateModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {t('global.cancel') || 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
                >
                  {updating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  <span>{t('indexes.update') || 'Update Index'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
