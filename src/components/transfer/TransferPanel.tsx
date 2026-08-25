import React, { useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Archive,
  RotateCcw,
  Trash2,
  Check,
  Loader2,
  ChevronDown,
  ChevronRight,
  Pause,
  Play,
  Inbox,
  X,
} from 'lucide-react'
import { useTransferStore, TransferTask } from '~/store/useTransferStore'
import { getFileSize } from '~/utils/str'
import { useT } from '~/lang'

export interface TransferPanelProps {
  onClose?: () => void
  isMobile?: boolean
}

export const TransferPanel: React.FC<TransferPanelProps> = ({
  isMobile = false,
}) => {
  const t = useT()
  const {
    tasks,
    pauseTask,
    resumeTask,
    removeTask,
    retryTask,
    clearCompleted,
  } = useTransferStore()

  const [expandedPackages, setExpandedPackages] = useState<Record<string, boolean>>({})

  const togglePackageExpand = (id: string) => {
    setExpandedPackages((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }))
  }

  // 1. Upload Task Aggregations
  const uploadTasks = tasks.filter((t) => t.type === 'upload')
  const activeUploadTasks = uploadTasks.filter(
    (t) => t.status === 'uploading' || t.status === 'hashing' || t.status === 'backending'
  )
  const completedUploadTasks = uploadTasks.filter((t) => t.status === 'success')
  const totalUploadBytes = uploadTasks.reduce((sum, t) => sum + (t.file?.size || t.size || 0), 0)
  const loadedUploadBytes = uploadTasks.reduce((sum, t) => {
    if (t.status === 'success') return sum + (t.file?.size || t.size || 0)
    return sum + (t.loaded || 0)
  }, 0)
  const uploadProgress =
    totalUploadBytes > 0
      ? Math.min(100, Math.round((loadedUploadBytes / totalUploadBytes) * 100))
      : completedUploadTasks.length === uploadTasks.length && uploadTasks.length > 0
      ? 100
      : 0
  const uploadSpeed = activeUploadTasks.reduce((sum, t) => sum + (t.speed || 0), 0)

  // 2. Download / Package Task Aggregations
  const downloadTasks = tasks.filter((t) => t.type === 'download' || t.type === 'package')
  const activeDownloadTasks = downloadTasks.filter(
    (t) => t.status === 'downloading' || t.status === 'processing'
  )
  const completedDownloadTasks = downloadTasks.filter((t) => t.status === 'success')
  const totalDownloadBytes = downloadTasks.reduce((sum, t) => sum + (t.size || 0), 0)
  const loadedDownloadBytes = downloadTasks.reduce((sum, t) => {
    if (t.status === 'success') return sum + (t.size || 0)
    return sum + (t.loaded || 0)
  }, 0)
  const downloadProgress =
    totalDownloadBytes > 0
      ? Math.min(100, Math.round((loadedDownloadBytes / totalDownloadBytes) * 100))
      : completedDownloadTasks.length === downloadTasks.length && downloadTasks.length > 0
      ? 100
      : 0
  const downloadSpeed = activeDownloadTasks.reduce((sum, t) => sum + (t.speed || 0), 0)

  // 3. Flags
  const hasUpload = uploadTasks.length > 0
  const hasDownload = downloadTasks.length > 0
  const isUploading = activeUploadTasks.length > 0
  const isDownloading = activeDownloadTasks.length > 0
  const activeCount = activeUploadTasks.length + activeDownloadTasks.length
  const completedTasks = tasks.filter((t) => t.status === 'success')
  const isAllDone = tasks.length > 0 && activeCount === 0 && tasks.every((t) => t.status === 'success' || t.status === 'canceled')

  return (
    <div className="flex flex-col select-none">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center space-x-2 min-w-0">
          <ArrowUpDown className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
            {t('home.transfer.title') || '传输列表'}
          </span>
          {tasks.length > 0 && (
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-mono tabular-nums text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400 font-medium shrink-0">
              {completedTasks.length}/{tasks.length}
            </span>
          )}
        </div>

        {/* Global Transfer Rate Indicators */}
        <div className="flex items-center space-x-1.5">
          {/* Upload Rate */}
          {hasUpload && (isUploading || uploadSpeed > 0) && (
            <span className="flex items-center space-x-1 font-mono text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded-md">
              <ArrowUp className="h-2.5 w-2.5" />
              <span>{uploadProgress}%</span>
              <span>·</span>
              <span>{getFileSize(uploadSpeed)}/s</span>
            </span>
          )}

          {/* Download Rate */}
          {hasDownload && (isDownloading || downloadSpeed > 0) && (
            <span className="flex items-center space-x-1 font-mono text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded-md">
              <ArrowDown className="h-2.5 w-2.5" />
              <span>{downloadProgress}%</span>
              <span>·</span>
              <span>{getFileSize(downloadSpeed)}/s</span>
            </span>
          )}
        </div>
      </div>

      {/* Task List / Empty State */}
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-slate-400 space-y-1.5">
          <Inbox className="h-8 w-8 text-slate-300 dark:text-slate-700 stroke-[1.5]" />
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('home.transfer.empty') || '暂无传输任务'}</p>
        </div>
      ) : (
        <div className={`overflow-y-auto space-y-2.5 pr-0.5 ${isMobile ? 'max-h-[50vh]' : 'max-h-[340px]'}`}>
          {tasks.map((task) => {
            if (task.type === 'package') {
              return (
                <PackageTaskItem
                  key={task.id}
                  task={task}
                  isExpanded={expandedPackages[task.id] !== false}
                  onToggleExpand={() => togglePackageExpand(task.id)}
                  onPause={() => pauseTask(task.id)}
                  onResume={() => resumeTask(task.id)}
                  onRemove={() => removeTask(task.id)}
                  onRetry={() => retryTask(task.id)}
                />
              )
            }

            return (
              <StandardTaskItem
                key={task.id}
                task={task}
                onPause={() => pauseTask(task.id)}
                onResume={() => resumeTask(task.id)}
                onRemove={() => removeTask(task.id)}
                onRetry={() => retryTask(task.id)}
              />
            )
          })}
        </div>
      )}

      {/* Footer Controls */}
      {tasks.length > 0 && (
        <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
          <span className="text-slate-400">
            {isAllDone
              ? (t('home.transfer.completed') || '已完成')
              : `${activeCount} ${t('home.transfer.title') || '进行中'}`}
          </span>

          {completedTasks.length > 0 && (
            <button
              onClick={clearCompleted}
              className="flex items-center space-x-1 font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <Trash2 className="h-3 w-3" />
              <span>{t('home.transfer.clear_completed') || '清空已完成'} ({completedTasks.length})</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Standard Single File Task (Upload / Download)
 */
const StandardTaskItem: React.FC<{
  task: TransferTask
  onPause: () => void
  onResume: () => void
  onRemove: () => void
  onRetry: () => void
}> = ({ task, onPause, onResume, onRemove, onRetry }) => {
  const t = useT()

  return (
    <div className="flex flex-col space-y-1.5 rounded-xl p-1.5 transition-colors bg-slate-50/60 dark:bg-slate-800/40">
      {/* Row 1: Type icon, File name & Size */}
      <div className="flex items-center justify-between space-x-2">
        <div className="flex items-center space-x-1.5 truncate flex-1 min-w-0">
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${
              task.type === 'download'
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400'
            }`}
            title={task.type === 'download' ? (t('home.transfer.downloading') || '下载') : (t('home.transfer.uploading') || '上传')}
          >
            {task.type === 'download' ? (
              <ArrowDown className="h-2.5 w-2.5 stroke-[2.5]" />
            ) : (
              <ArrowUp className="h-2.5 w-2.5 stroke-[2.5]" />
            )}
          </span>
          <span
            className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100"
            title={task.name}
          >
            {task.name}
          </span>
        </div>
        <span className="shrink-0 font-mono tabular-nums text-[10px] text-slate-400">
          {getFileSize(task.size)}
        </span>
      </div>

      {/* Row 2: Slim Progress Bar */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200/60 dark:bg-slate-800">
        <div
          className={`h-full transition-all duration-200 ${
            task.status === 'success'
              ? 'bg-emerald-500'
              : task.status === 'hashing'
              ? 'bg-purple-500 animate-pulse'
              : task.status === 'backending'
              ? 'bg-amber-500 animate-pulse'
              : task.status === 'processing'
              ? 'bg-amber-500 animate-pulse'
              : task.status === 'paused'
              ? 'bg-amber-500'
              : task.status === 'error'
              ? 'bg-rose-500'
              : task.status === 'canceled'
              ? 'bg-slate-300 dark:bg-slate-700'
              : 'bg-indigo-600 dark:bg-indigo-500'
          }`}
          style={{ width: `${task.progress}%` }}
        />
      </div>

      {/* Row 3: Status info & inline action */}
      <div className="flex items-center justify-between text-[10px]">
        <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400">
          {task.status === 'downloading' && (
            <>
              <span className="text-blue-600 dark:text-blue-400 font-semibold">
                {t('home.transfer.downloading') || '下载中'}
              </span>
              {task.speed > 0 && (
                <span className="font-mono tabular-nums text-slate-400">
                  {getFileSize(task.speed)}/s
                </span>
              )}
            </>
          )}

          {task.status === 'hashing' && (
            <span className="text-purple-600 dark:text-purple-400 font-semibold flex items-center space-x-1">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              <span>{t('home.upload.hashing') || '计算秒传中...'}</span>
            </span>
          )}

          {task.status === 'uploading' && (
            <>
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                {t('home.transfer.uploading') || '上传中'}
              </span>
              {task.speed > 0 && (
                <span className="font-mono tabular-nums text-slate-400">
                  {getFileSize(task.speed)}/s
                </span>
              )}
            </>
          )}

          {task.status === 'backending' && (
            <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center space-x-1">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              <span>{t('home.upload.backending') || '转存中...'}</span>
            </span>
          )}

          {task.status === 'processing' && (
            <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center space-x-1">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              <span>
                {t('home.upload.processing') || '处理中...'}
              </span>
            </span>
          )}

          {task.status === 'paused' && (
            <span className="text-amber-600 dark:text-amber-400 font-semibold">
              {t('home.transfer.paused') || '已暂停'}
            </span>
          )}

          {task.status === 'pending' && (
            <span>{t('home.upload.pending') || '排队中...'}</span>
          )}

          {task.status === 'success' && (
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center space-x-1">
              <Check className="h-2.5 w-2.5" />
              <span>
                {t('home.transfer.completed') || '已完成'}
              </span>
            </span>
          )}

          {task.status === 'error' && (
            <span className="text-rose-500 font-semibold truncate max-w-[180px]">
              {task.error || (t('home.transfer.error') || '失败')}
            </span>
          )}

          {task.status === 'canceled' && (
            <span className="text-slate-400 font-medium">
              {t('home.transfer.canceled') || '已取消'}
            </span>
          )}
        </div>

        {/* Action Buttons & Percentage */}
        <div className="flex items-center space-x-2.5 font-mono tabular-nums text-slate-400">
          <span className="w-8 text-right font-medium">{task.progress}%</span>

          <div className="flex items-center space-x-1">
            {(task.status === 'uploading' ||
              task.status === 'hashing' ||
              task.status === 'backending' ||
              task.status === 'downloading' ||
              task.status === 'processing') && (
              <button
                onClick={onPause}
                title={t('home.transfer.pause') || '暂停'}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <Pause className="h-3 w-3" />
              </button>
            )}

            {task.status === 'paused' && (
              <button
                onClick={onResume}
                title={t('home.transfer.resume') || '继续'}
                className="rounded p-0.5 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/60 transition-colors cursor-pointer"
              >
                <Play className="h-3 w-3" />
              </button>
            )}

            {(task.status === 'error' || task.status === 'canceled') && (
              <button
                onClick={onRetry}
                title={t('home.transfer.retry') || '重试'}
                className="rounded p-0.5 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/60 transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            )}

            <button
              onClick={onRemove}
              title={t('home.transfer.delete') || '删除任务'}
              className="rounded p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/60 dark:hover:text-rose-400 transition-colors cursor-pointer"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Grouped Package Task with Sticky Pinned Header & Detailed Sub-File Progress
 */
const PackageTaskItem: React.FC<{
  task: TransferTask
  isExpanded: boolean
  onToggleExpand: () => void
  onPause: () => void
  onResume: () => void
  onRemove: () => void
  onRetry: () => void
}> = ({
  task,
  isExpanded,
  onToggleExpand,
  onPause,
  onResume,
  onRemove,
  onRetry,
}) => {
  const t = useT()
  const subFiles = task.subFiles || []
  const completedCount = task.completedFilesCount || 0
  const totalCount = task.totalFilesCount || subFiles.length
  const isCanceled = task.status === 'canceled'
  const isError = task.status === 'error'
  const isSuccess = task.status === 'success'
  const isPaused = task.status === 'paused'

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50/50 dark:border-slate-800/80 dark:bg-slate-900/50">
      {/* Sticky Header: Pins to top of block during scroll */}
      <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-2.5 py-2 border-b border-slate-100 dark:border-slate-800/80 shadow-xs">
        {/* Row 1: Icon, Archive Name, File Counter & Size */}
        <div className="flex items-center justify-between space-x-1.5">
          <div
            onClick={onToggleExpand}
            className="flex items-center space-x-1.5 truncate flex-1 min-w-0 cursor-pointer select-none"
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <Archive className="h-2.5 w-2.5 stroke-[2.5]" />
            </span>
            <span
              className="truncate text-xs font-bold text-slate-900 dark:text-slate-100"
              title={task.name}
            >
              {task.name}
            </span>
            {totalCount > 0 && (
              <span className="rounded-full bg-slate-200/60 px-1.5 py-0.2 font-mono tabular-nums text-[9px] text-slate-600 dark:bg-slate-800 dark:text-slate-300 font-semibold">
                {completedCount}/{totalCount}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            <span className="font-mono tabular-nums text-[10px] text-slate-400">
              {getFileSize(task.size)}
            </span>
            <button
              onClick={onToggleExpand}
              className="rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Row 2: Slim Progress Bar */}
        <div className="my-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-200/60 dark:bg-slate-800">
          <div
            className={`h-full transition-all duration-200 ${
              isSuccess
                ? 'bg-emerald-500'
                : isError
                ? 'bg-rose-500'
                : isCanceled
                ? 'bg-slate-300 dark:bg-slate-700'
                : isPaused
                ? 'bg-amber-500'
                : task.phase === 'packaging'
                ? 'bg-amber-500 animate-pulse'
                : 'bg-indigo-600 dark:bg-indigo-500'
            }`}
            style={{ width: `${task.progress}%` }}
          />
        </div>

        {/* Row 3: Phase / Speed / Percentage / Actions */}
        <div className="flex items-center justify-between text-[10px]">
          <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400">
            {isCanceled ? (
              <span className="text-slate-400 font-medium">
                {t('home.transfer.canceled') || '已取消'}
              </span>
            ) : isPaused ? (
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                {t('home.transfer.paused_package_status', {
                  completed: completedCount,
                  total: totalCount,
                }) || `已暂停 (${completedCount}/${totalCount} 就绪)`}
              </span>
            ) : isError ? (
              <span className="text-rose-500 font-semibold truncate max-w-[180px]">
                {task.error || (t('home.transfer.error') || '打包失败')}
              </span>
            ) : isSuccess ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center space-x-1">
                <Check className="h-2.5 w-2.5" />
                <span>
                  {t('home.transfer.package_completed') || '打包完成 (.zip)'}
                </span>
              </span>
            ) : task.phase === 'scanning' ? (
              <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center space-x-1">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                <span>
                  {t('home.transfer.scanning') || '扫描目录中...'}
                </span>
              </span>
            ) : task.phase === 'packaging' ? (
              <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center space-x-1">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                <span>
                  {t('home.transfer.packaging') || '正在生成 ZIP...'}
                </span>
              </span>
            ) : (
              <>
                <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                  {t('home.transfer.package_downloading') || '打包下载中'} ({completedCount}/{totalCount})
                </span>
                {task.speed > 0 && (
                  <span className="font-mono tabular-nums text-slate-400">
                    {getFileSize(task.speed)}/s
                  </span>
                )}
              </>
            )}
          </div>

          <div className="flex items-center space-x-2.5 font-mono tabular-nums text-slate-400">
            <span className="w-8 text-right font-medium">{task.progress}%</span>

            <div className="flex items-center space-x-1">
              {!isCanceled && !isError && !isSuccess && !isPaused && (
                <button
                  onClick={onPause}
                  title={t('home.transfer.pause_package') || '暂停打包'}
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <Pause className="h-3 w-3" />
                </button>
              )}

              {isPaused && (
                <button
                  onClick={onResume}
                  title={t('home.transfer.continue_package') || '继续打包'}
                  className="rounded p-0.5 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/60 transition-colors cursor-pointer"
                >
                  <Play className="h-3 w-3" />
                </button>
              )}

              {(isCanceled || isError) && (
                <button
                  onClick={onRetry}
                  title={t('home.transfer.retry') || '重试'}
                  className="rounded p-0.5 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/60 transition-colors cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              )}

              <button
                onClick={onRemove}
                title={t('home.transfer.delete') || '删除任务'}
                className="rounded p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/60 dark:hover:text-rose-400 transition-colors cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Files List (Scrollable inside the card) */}
      {isExpanded && subFiles.length > 0 && (
        <div className="max-h-40 overflow-y-auto px-2.5 py-1.5 space-y-1 divide-y divide-slate-100 dark:divide-slate-800/40">
          {subFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between pt-1 text-[10px] text-slate-600 dark:text-slate-300"
            >
              <div className="flex items-center space-x-1.5 truncate flex-1 min-w-0 pr-2">
                {file.status === 'success' ? (
                  <Check className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
                ) : !isCanceled && !isPaused && file.status === 'downloading' ? (
                  <Loader2 className="h-2.5 w-2.5 text-indigo-600 dark:text-indigo-400 animate-spin shrink-0" />
                ) : isPaused ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0 ml-0.5 mr-0.5" />
                ) : file.status === 'error' ? (
                  <X className="h-2.5 w-2.5 text-rose-500 shrink-0" />
                ) : (
                  <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0 ml-0.5 mr-1" />
                )}
                <span
                  className={`truncate ${
                    file.status === 'downloading' && !isCanceled && !isPaused
                      ? 'font-semibold text-slate-800 dark:text-slate-100'
                      : ''
                  }`}
                  title={file.path}
                >
                  {file.name}
                </span>
              </div>

              <div className="flex items-center space-x-1.5 shrink-0 font-mono tabular-nums text-[9px] text-slate-400">
                <span>{getFileSize(file.size)}</span>
                {!isCanceled && !isPaused && file.status === 'downloading' && (
                  <span className="w-7 text-right font-semibold text-indigo-600 dark:text-indigo-400">
                    {file.progress}%
                  </span>
                )}
                {file.status === 'success' && (
                  <span className="w-7 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                    {t('home.transfer.ready') || '就绪'}
                  </span>
                )}
                {isPaused && (
                  <span className="w-7 text-right text-amber-500 font-medium">
                    {t('home.transfer.waiting') || '等待'}
                  </span>
                )}
                {isCanceled && (
                  <span className="w-7 text-right text-slate-400">
                    {t('home.transfer.stopped') || '停止'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
