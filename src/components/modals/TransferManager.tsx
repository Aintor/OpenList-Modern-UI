import React, { useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Archive,
  X,
  RotateCcw,
  Trash2,
  Check,
  Loader2,
  Minimize2,
  Maximize2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useTransferStore, TransferTask } from '~/store/useTransferStore'
import { getFileSize } from '~/utils/str'
import { useT } from '~/lang'

export const TransferManager: React.FC = () => {
  const t = useT()
  const {
    tasks,
    isOpen,
    isMinimized,
    toggleMinimized,
    setOpen,
    cancelTask,
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

  if (!isOpen || tasks.length === 0) return null

  const activeTasks = tasks.filter(
    (task) =>
      task.status === 'uploading' ||
      task.status === 'downloading' ||
      task.status === 'processing'
  )
  const completedTasks = tasks.filter((task) => task.status === 'success')
  const totalSpeed = activeTasks.reduce((sum, task) => sum + (task.speed || 0), 0)
  const isAllDone = activeTasks.length === 0 && tasks.length > 0

  // 1. Minimized Floating Capsule View
  if (isMinimized) {
    const firstActive = activeTasks[0] || tasks[0]
    return (
      <div
        onClick={toggleMinimized}
        className="fixed bottom-6 right-6 z-40 flex items-center space-x-2.5 rounded-2xl border border-slate-200/80 bg-white/90 px-3.5 py-2 shadow-lg shadow-black/5 backdrop-blur-xl transition-all hover:scale-105 dark:border-slate-800/80 dark:bg-slate-900/90 cursor-pointer animate-in fade-in slide-in-from-bottom-3 duration-150"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
          {activeTasks.length > 0 ? (
            firstActive.type === 'package' ? (
              <Archive className="h-3.5 w-3.5 animate-pulse text-amber-600 dark:text-amber-400" />
            ) : firstActive.type === 'download' ? (
              <ArrowDown className="h-3.5 w-3.5 animate-bounce text-blue-600 dark:text-blue-400" />
            ) : (
              <ArrowUp className="h-3.5 w-3.5 animate-bounce text-indigo-600 dark:text-indigo-400" />
            )
          ) : isAllDone ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5" />
          )}
        </div>

        <div className="flex items-center space-x-2 text-xs font-medium text-slate-800 dark:text-slate-200">
          <span className="truncate max-w-[140px] font-semibold">{firstActive.name}</span>
          <span className="font-mono tabular-nums text-indigo-600 dark:text-indigo-400 font-semibold">
            {firstActive.progress}%
          </span>
          {totalSpeed > 0 && (
            <span className="font-mono tabular-nums text-[11px] text-slate-400">
              {getFileSize(totalSpeed)}/s
            </span>
          )}
        </div>

        <Maximize2 className="h-3 w-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ml-1" />
      </div>
    )
  }

  // 2. Ultra-Clean Minimalist Panel View
  return (
    <div className="fixed bottom-6 right-6 z-40 flex w-[370px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-3.5 shadow-xl shadow-black/10 backdrop-blur-2xl dark:border-slate-800/80 dark:bg-slate-900/95 animate-in fade-in slide-in-from-bottom-3 duration-150">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center space-x-2">
          <ArrowUpDown className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
            {t('home.transfer.title') !== 'home.transfer.title'
              ? t('home.transfer.title')
              : '传输列表'}
          </span>
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-mono tabular-nums text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400 font-medium">
            {completedTasks.length}/{tasks.length}
          </span>
          {totalSpeed > 0 && (
            <span className="font-mono tabular-nums text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
              {getFileSize(totalSpeed)}/s
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={toggleMinimized}
            title={t('global.minimize') || '最小化'}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={() => {
              if (isAllDone) {
                clearCompleted()
              }
              setOpen(false)
            }}
            title={t('global.close') || '关闭'}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="max-h-[340px] overflow-y-auto space-y-2.5 pr-0.5">
        {tasks.map((task) => {
          if (task.type === 'package') {
            return (
              <PackageTaskItem
                key={task.id}
                task={task}
                isExpanded={expandedPackages[task.id] !== false}
                onToggleExpand={() => togglePackageExpand(task.id)}
                onCancel={() => cancelTask(task.id)}
                onRemove={() => removeTask(task.id)}
                onRetry={() => retryTask(task.id)}
              />
            )
          }

          return (
            <StandardTaskItem
              key={task.id}
              task={task}
              onCancel={() => cancelTask(task.id)}
              onRemove={() => removeTask(task.id)}
              onRetry={() => retryTask(task.id)}
            />
          )
        })}
      </div>
    </div>
  )
}

/**
 * Standard Single File Task (Upload / Download)
 */
const StandardTaskItem: React.FC<{
  task: TransferTask
  onCancel: () => void
  onRemove: () => void
  onRetry: () => void
}> = ({ task, onCancel, onRemove, onRetry }) => {
  const t = useT()

  return (
    <div className="flex flex-col space-y-1.5 rounded-xl p-1 transition-colors">
      {/* Row 1: Type icon, File name & Size */}
      <div className="flex items-center justify-between space-x-2">
        <div className="flex items-center space-x-1.5 truncate flex-1 min-w-0">
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${
              task.type === 'download'
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400'
            }`}
            title={task.type === 'download' ? '下载' : '上传'}
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
      <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-full transition-all duration-200 ${
            task.status === 'success'
              ? 'bg-emerald-500'
              : task.status === 'processing'
              ? 'bg-amber-500 animate-pulse'
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
                {t('home.transfer.downloading') !== 'home.transfer.downloading'
                  ? t('home.transfer.downloading')
                  : '下载中'}
              </span>
              {task.speed > 0 && (
                <span className="font-mono tabular-nums text-slate-400">
                  {getFileSize(task.speed)}/s
                </span>
              )}
            </>
          )}

          {task.status === 'uploading' && (
            <>
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                {t('home.transfer.uploading') !== 'home.transfer.uploading'
                  ? t('home.transfer.uploading')
                  : '上传中'}
              </span>
              {task.speed > 0 && (
                <span className="font-mono tabular-nums text-slate-400">
                  {getFileSize(task.speed)}/s
                </span>
              )}
            </>
          )}

          {task.status === 'processing' && (
            <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center space-x-1">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              <span>
                {t('home.upload.processing') !== 'home.upload.processing'
                  ? t('home.upload.processing')
                  : '处理中...'}
              </span>
            </span>
          )}

          {task.status === 'pending' && <span>排队中...</span>}

          {task.status === 'success' && (
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center space-x-1">
              <Check className="h-2.5 w-2.5" />
              <span>
                {t('home.transfer.completed') !== 'home.transfer.completed'
                  ? t('home.transfer.completed')
                  : '已完成'}
              </span>
            </span>
          )}

          {task.status === 'error' && (
            <span className="text-rose-500 font-semibold truncate max-w-[180px]">
              {task.error || (t('home.transfer.error') !== 'home.transfer.error' ? t('home.transfer.error') : '失败')}
            </span>
          )}

          {task.status === 'canceled' && (
            <span className="text-slate-400 font-medium">
              {t('home.transfer.canceled') !== 'home.transfer.canceled'
                ? t('home.transfer.canceled')
                : '已取消'}
            </span>
          )}
        </div>

        {/* Action Buttons & Percentage */}
        <div className="flex items-center space-x-1.5 font-mono tabular-nums text-slate-400">
          <span className="w-8 text-right font-medium">{task.progress}%</span>

          {(task.status === 'uploading' ||
            task.status === 'downloading' ||
            task.status === 'processing' ||
            task.status === 'pending') && (
            <button
              onClick={onCancel}
              title={t('home.transfer.cancel') || '取消'}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          )}

          {(task.status === 'error' || task.status === 'canceled' || task.status === 'success') && (
            <div className="flex items-center space-x-1">
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
          )}
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
  onCancel: () => void
  onRemove: () => void
  onRetry: () => void
}> = ({ task, isExpanded, onToggleExpand, onCancel, onRemove, onRetry }) => {
  const t = useT()
  const subFiles = task.subFiles || []
  const completedCount = task.completedFilesCount || 0
  const totalCount = task.totalFilesCount || subFiles.length
  const isCanceled = task.status === 'canceled'
  const isError = task.status === 'error'
  const isSuccess = task.status === 'success'

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
                {t('home.transfer.canceled') !== 'home.transfer.canceled'
                  ? t('home.transfer.canceled')
                  : '已取消'}
              </span>
            ) : isError ? (
              <span className="text-rose-500 font-semibold truncate max-w-[180px]">
                {task.error || (t('home.transfer.error') !== 'home.transfer.error' ? t('home.transfer.error') : '打包失败')}
              </span>
            ) : isSuccess ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center space-x-1">
                <Check className="h-2.5 w-2.5" />
                <span>
                  {t('home.transfer.completed') !== 'home.transfer.completed'
                    ? t('home.transfer.completed')
                    : '打包完成 (.zip)'}
                </span>
              </span>
            ) : task.phase === 'scanning' ? (
              <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center space-x-1">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                <span>
                  {t('home.transfer.scanning') !== 'home.transfer.scanning'
                    ? t('home.transfer.scanning')
                    : '扫描目录中...'}
                </span>
              </span>
            ) : task.phase === 'packaging' ? (
              <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center space-x-1">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                <span>
                  {t('home.transfer.packaging') !== 'home.transfer.packaging'
                    ? t('home.transfer.packaging')
                    : '正在生成 ZIP...'}
                </span>
              </span>
            ) : (
              <>
                <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                  {t('home.transfer.package_downloading') !== 'home.transfer.package_downloading'
                    ? t('home.transfer.package_downloading')
                    : '打包下载中'} ({completedCount}/{totalCount})
                </span>
                {task.speed > 0 && (
                  <span className="font-mono tabular-nums text-slate-400">
                    {getFileSize(task.speed)}/s
                  </span>
                )}
              </>
            )}
          </div>

          <div className="flex items-center space-x-1.5 font-mono tabular-nums text-slate-400">
            <span className="w-8 text-right font-medium">{task.progress}%</span>

            {!isCanceled && !isError && !isSuccess && (
              <button
                onClick={onCancel}
                title={t('home.transfer.cancel') || '取消打包'}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            )}

            {(isCanceled || isError || isSuccess) && (
              <div className="flex items-center space-x-1">
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
            )}
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
                ) : !isCanceled && file.status === 'downloading' ? (
                  <Loader2 className="h-2.5 w-2.5 text-indigo-600 dark:text-indigo-400 animate-spin shrink-0" />
                ) : file.status === 'error' ? (
                  <X className="h-2.5 w-2.5 text-rose-500 shrink-0" />
                ) : (
                  <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0 ml-0.5 mr-1" />
                )}
                <span className={`truncate ${file.status === 'downloading' && !isCanceled ? 'font-semibold text-slate-800 dark:text-slate-100' : ''}`} title={file.path}>
                  {file.name}
                </span>
              </div>

              <div className="flex items-center space-x-1.5 shrink-0 font-mono tabular-nums text-[9px] text-slate-400">
                <span>{getFileSize(file.size)}</span>
                {!isCanceled && file.status === 'downloading' && (
                  <span className="w-7 text-right font-semibold text-indigo-600 dark:text-indigo-400">
                    {file.progress}%
                  </span>
                )}
                {file.status === 'success' && (
                  <span className="w-7 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                    完成
                  </span>
                )}
                {isCanceled && file.status !== 'success' && (
                  <span className="w-7 text-right text-slate-400">
                    停止
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
