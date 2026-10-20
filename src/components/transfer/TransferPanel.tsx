import React, { useState, useRef } from 'react'
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
  FolderUp,
  AlertCircle,
} from 'lucide-react'
import {
  useTransferStore,
  TransferTask,
  getTaskGroupId,
  getTaskGroupName,
} from '~/store/useTransferStore'
import { getFileSize } from '~/utils/str'
import { useT } from '~/lang'
import { notify } from '~/utils/notify'

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
    pauseGroup,
    resumeGroup,
    removeGroup,
    clearCompleted,
    overwritePolicy,
    setOverwritePolicy,
  } = useTransferStore()

  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'completed'>('all')
  const [expandedPackages, setExpandedPackages] = useState<Record<string, boolean>>({})
  const [expandedFolderGroups, setExpandedFolderGroups] = useState<Record<string, boolean>>({})

  const togglePackageExpand = (id: string) => {
    setExpandedPackages((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }))
  }

  const toggleFolderGroupExpand = (groupId: string) => {
    setExpandedFolderGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
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

  // Group tasks for rendering
  type RenderItem =
    | { kind: 'package'; task: TransferTask }
    | { kind: 'folderGroup'; groupId: string; groupName: string; tasks: TransferTask[] }
    | { kind: 'single'; task: TransferTask }

  const getItemPriority = (item: RenderItem): number => {
    if (item.kind === 'package') {
      const s = item.task.status
      if (s === 'downloading' || s === 'processing') return 1
      if (s === 'pending') return 2
      if (s === 'paused') return 3
      if (s === 'error' || s === 'canceled') return 4
      return 5
    }
    if (item.kind === 'folderGroup') {
      const ts = item.tasks
      if (ts.some((t) => t.status === 'uploading' || t.status === 'hashing' || t.status === 'backending')) return 1
      if (ts.some((t) => t.status === 'pending')) return 2
      if (ts.some((t) => t.status === 'paused')) return 3
      if (ts.some((t) => t.status === 'error' || t.status === 'canceled')) return 4
      return 5
    }
    const s = item.task.status
    if (s === 'uploading' || s === 'downloading' || s === 'hashing' || s === 'backending' || s === 'processing') return 1
    if (s === 'pending') return 2
    if (s === 'paused') return 3
    if (s === 'error' || s === 'canceled') return 4
    return 5
  }

  const seenFolderGroups = new Set<string>()
  const rawItems: RenderItem[] = []

  tasks.forEach((task) => {
    if (task.type === 'package') {
      rawItems.push({ kind: 'package', task })
      return
    }

    const groupId = getTaskGroupId(task)
    if (groupId) {
      if (!seenFolderGroups.has(groupId)) {
        seenFolderGroups.add(groupId)
        const groupTasks = tasks.filter((t) => getTaskGroupId(t) === groupId)
        const groupName = getTaskGroupName(groupTasks[0]) || '文件夹上传'
        rawItems.push({
          kind: 'folderGroup',
          groupId,
          groupName,
          tasks: groupTasks,
        })
      }
      return
    }

    rawItems.push({ kind: 'single', task })
  })

  // Sort items: 正在进行的排前面 (1), 等待排队的放中间 (2, 3), 失败的 (4), 已完成的沉底 (5)
  const allSortedItems = [...rawItems].sort((a, b) => getItemPriority(a) - getItemPriority(b))

  const activeItems = allSortedItems.filter((item) => getItemPriority(item) < 5)
  const completedItems = allSortedItems.filter((item) => getItemPriority(item) === 5)

  const displayedItems =
    activeTab === 'active'
      ? activeItems
      : activeTab === 'completed'
      ? completedItems
      : allSortedItems

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

      {/* Tabs */}
      {tasks.length > 0 && (
        <div className="flex items-center space-x-1 p-0.5 mb-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-[11px] font-medium">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 flex items-center justify-center space-x-1 py-1 rounded-md transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <span>{t('home.transfer.tab_all') || '全部'}</span>
            <span className="font-mono text-[10px] opacity-75">({allSortedItems.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 flex items-center justify-center space-x-1 py-1 rounded-md transition-all cursor-pointer ${
              activeTab === 'active'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <span>{t('home.transfer.tab_active') || '进行中'}</span>
            {activeItems.length > 0 && (
              <span className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                ({activeItems.length})
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex-1 flex items-center justify-center space-x-1 py-1 rounded-md transition-all cursor-pointer ${
              activeTab === 'completed'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <span>{t('home.transfer.tab_completed') || '已完成'}</span>
            {completedItems.length > 0 && (
              <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                ({completedItems.length})
              </span>
            )}
          </button>
        </div>
      )}

      {/* Task List / Empty State */}
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-slate-400 space-y-1.5">
          <Inbox className="h-8 w-8 text-slate-300 dark:text-slate-700 stroke-[1.5]" />
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('home.transfer.empty') || '暂无传输任务'}</p>
        </div>
      ) : displayedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-slate-400 space-y-1.5">
          <Inbox className="h-8 w-8 text-slate-300 dark:text-slate-700 stroke-[1.5]" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {activeTab === 'active'
              ? '暂无进行中或等待的任务'
              : activeTab === 'completed'
              ? '暂无已完成的任务'
              : t('home.transfer.empty') || '暂无传输任务'}
          </p>
        </div>
      ) : (
        <div className={`overflow-y-auto space-y-2.5 pr-0.5 ${isMobile ? 'max-h-[50vh]' : 'max-h-[340px]'}`}>
          {displayedItems.map((item) => {
            if (item.kind === 'package') {
              return (
                <PackageTaskItem
                  key={item.task.id}
                  task={item.task}
                  isExpanded={expandedPackages[item.task.id] !== false}
                  onToggleExpand={() => togglePackageExpand(item.task.id)}
                  onPause={() => pauseTask(item.task.id)}
                  onResume={() => resumeTask(item.task.id)}
                  onRemove={() => removeTask(item.task.id)}
                  onRetry={() => retryTask(item.task.id)}
                />
              )
            }

            if (item.kind === 'folderGroup') {
              return (
                <FolderGroupTaskItem
                  key={item.groupId}
                  groupId={item.groupId}
                  groupName={item.groupName}
                  tasks={item.tasks}
                  isExpanded={!!expandedFolderGroups[item.groupId]}
                  onToggleExpand={() => toggleFolderGroupExpand(item.groupId)}
                  onPauseGroup={() => pauseGroup(item.groupId)}
                  onResumeGroup={() => resumeGroup(item.groupId)}
                  onRemoveGroup={() => removeGroup(item.groupId)}
                  onPauseTask={(id) => pauseTask(id)}
                  onResumeTask={(id) => resumeTask(id)}
                  onRemoveTask={(id) => removeTask(id)}
                  onRetryTask={(id) => retryTask(id)}
                />
              )
            }

            return (
              <StandardTaskItem
                key={item.task.id}
                task={item.task}
                onPause={() => pauseTask(item.task.id)}
                onResume={() => resumeTask(item.task.id)}
                onRemove={() => removeTask(item.task.id)}
                onRetry={() => retryTask(item.task.id)}
              />
            )
          })}
        </div>
      )}

      {/* Footer Controls */}
      {tasks.length > 0 && (
        <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">
              {isAllDone
                ? (t('home.transfer.completed') || '已完成')
                : `${activeCount} ${t('home.transfer.title') || '进行中'}`}
            </span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <button
              onClick={() =>
                setOverwritePolicy(overwritePolicy === 'skip' ? 'overwrite' : 'skip')
              }
              title={overwritePolicy === 'skip' ? '当前策略：跳过已存在文件（点击切换）' : '当前策略：覆盖已存在文件（点击切换）'}
              className="text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors cursor-pointer font-medium"
            >
              {overwritePolicy === 'skip' ? '跳过同名' : '覆盖同名'}
            </button>
          </div>

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
  const singleFileInputRef = useRef<HTMLInputElement>(null)
  const isUploadMissingFile = task.type === 'upload' && !task.file && task.status !== 'success'

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

          {isUploadMissingFile ? (
            <span className="text-amber-600 dark:text-amber-400 font-semibold truncate max-w-[180px]">
              句柄已失效，请重新关联
            </span>
          ) : task.status === 'error' && (
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

            {isUploadMissingFile ? (
              <>
                <button
                  onClick={() => singleFileInputRef.current?.click()}
                  title="重新选择该文件继续上传"
                  className="rounded p-0.5 text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/60 transition-colors cursor-pointer"
                >
                  <FolderUp className="h-3 w-3" />
                </button>
                <input
                  ref={singleFileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      useTransferStore.getState().rebindTaskFile(task.id, e.target.files[0])
                      notify.success(`已重新关联文件：${e.target.files[0].name}`)
                    }
                    e.target.value = ''
                  }}
                />
              </>
            ) : (task.status === 'error' || task.status === 'canceled') && (
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

              <div className="flex items-center space-x-2 shrink-0 font-mono tabular-nums text-[10px]">
                <span className="w-14 text-right text-slate-400 dark:text-slate-500">{getFileSize(file.size)}</span>
                <div className="w-10 text-right">
                  {!isCanceled && !isPaused && file.status === 'downloading' && (
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      {file.progress}%
                    </span>
                  )}
                  {file.status === 'success' && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      就绪
                    </span>
                  )}
                  {isPaused && (
                    <span className="text-amber-500 font-medium">
                      等待
                    </span>
                  )}
                  {isCanceled && (
                    <span className="text-slate-400">
                      停止
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Grouped Folder Upload Task with Sticky Header & Sub-Files Details
 */
const FolderGroupTaskItem: React.FC<{
  groupId: string
  groupName: string
  tasks: TransferTask[]
  isExpanded: boolean
  onToggleExpand: () => void
  onPauseGroup: () => void
  onResumeGroup: () => void
  onRemoveGroup: () => void
  onPauseTask: (id: string) => void
  onResumeTask: (id: string) => void
  onRemoveTask: (id: string) => void
  onRetryTask: (id: string) => void
}> = ({
  groupId,
  groupName,
  tasks,
  isExpanded,
  onToggleExpand,
  onPauseGroup,
  onResumeGroup,
  onRemoveGroup,
  onPauseTask,
  onResumeTask,
  onRemoveTask,
  onRetryTask,
}) => {
  const t = useT()
  const groupFolderInputRef = useRef<HTMLInputElement>(null)
  const singleFileInputRef = useRef<HTMLInputElement>(null)
  const [activeSingleTaskId, setActiveSingleTaskId] = useState<string | null>(null)

  const { rebindGroupFiles, rebindTaskFile } = useTransferStore()

  const completedCount = tasks.filter((t) => t.status === 'success').length
  const totalCount = tasks.length
  const isAllSuccess = completedCount === totalCount && totalCount > 0

  const activeTasks = tasks.filter(
    (t) =>
      t.status === 'uploading' ||
      t.status === 'hashing' ||
      t.status === 'backending'
  )
  const isUploading = activeTasks.length > 0
  const isPaused =
    !isUploading &&
    !isAllSuccess &&
    tasks.some((t) => t.status === 'paused') &&
    tasks.every((t) => t.status === 'paused' || t.status === 'success' || t.status === 'canceled')

  const hasError = !isUploading && tasks.some((t) => t.status === 'error')
  const missingFiles = tasks.filter((t) => !t.file && t.status !== 'success')
  const hasMissingHandles = missingFiles.length > 0

  const totalBytes = tasks.reduce((sum, t) => sum + (t.file?.size || t.size || 0), 0)
  const loadedBytes = tasks.reduce((sum, t) => {
    if (t.status === 'success') return sum + (t.file?.size || t.size || 0)
    return sum + (t.loaded || 0)
  }, 0)
  const groupProgress =
    totalBytes > 0
      ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100))
      : isAllSuccess
      ? 100
      : 0
  const groupSpeed = activeTasks.reduce((sum, t) => sum + (t.speed || 0), 0)

  const handleFolderRebind = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    const files = Array.from(e.target.files)
    const { matched, total } = rebindGroupFiles(groupId, files)
    if (matched > 0) {
      notify.success(`已为文件夹「${groupName}」关联 ${matched}/${total} 个文件，恢复断点续传！`)
    } else {
      notify.warning(`未在该文件夹中匹配到待上传文件`)
    }
    e.target.value = ''
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50/50 dark:border-slate-800/80 dark:bg-slate-900/50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-2.5 py-2 border-b border-slate-100 dark:border-slate-800/80 shadow-xs">
        {/* Row 1: Folder icon, folder name, file counter, total size & chevron */}
        <div className="flex items-center justify-between space-x-1.5">
          <div
            onClick={onToggleExpand}
            className="flex items-center space-x-1.5 truncate flex-1 min-w-0 cursor-pointer select-none"
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <FolderUp className="h-2.5 w-2.5 stroke-[2.5]" />
            </span>
            <span
              className="truncate text-xs font-bold text-slate-900 dark:text-slate-100"
              title={groupName}
            >
              {groupName}
            </span>
            {totalCount > 0 && (
              <span className="rounded-full bg-slate-200/60 px-1.5 py-0.2 font-mono tabular-nums text-[9px] text-slate-600 dark:bg-slate-800 dark:text-slate-300 font-semibold">
                {completedCount}/{totalCount}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            <span className="font-mono tabular-nums text-[10px] text-slate-400">
              {getFileSize(totalBytes)}
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
              isAllSuccess
                ? 'bg-emerald-500'
                : hasError
                ? 'bg-rose-500'
                : isPaused
                ? 'bg-amber-500'
                : hasMissingHandles
                ? 'bg-amber-500'
                : 'bg-indigo-600 dark:bg-indigo-500'
            }`}
            style={{ width: `${groupProgress}%` }}
          />
        </div>

        {/* Row 3: Status / Speed / Actions */}
        <div className="flex items-center justify-between text-[10px]">
          <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400 truncate flex-1 min-w-0 pr-2">
            {isAllSuccess ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center space-x-1">
                <Check className="h-2.5 w-2.5" />
                <span>{t('home.transfer.completed') || '文件夹上传完成'}</span>
              </span>
            ) : hasMissingHandles ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  groupFolderInputRef.current?.click()
                }}
                className="flex items-center space-x-1 rounded bg-amber-100 hover:bg-amber-200/90 dark:bg-amber-950/70 dark:hover:bg-amber-900/80 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 font-medium transition-colors cursor-pointer"
                title="页面刷新后文件句柄已释放，点击选择该文件夹即可恢复上传"
              >
                <FolderUp className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>关联该文件夹 ({missingFiles.length} 个待关联)</span>
              </button>
            ) : isPaused ? (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                {t('home.transfer.paused') || '已暂停'}
              </span>
            ) : hasError ? (
              <span className="text-rose-500 font-medium truncate">
                部分文件上传失败
              </span>
            ) : isUploading ? (
              <div className="flex items-center space-x-1.5 font-medium">
                <span className="text-indigo-600 dark:text-indigo-400">
                  {t('home.transfer.uploading') || '上传中'}
                </span>
                {groupSpeed > 0 && (
                  <span className="font-mono tabular-nums text-slate-400">
                    · {getFileSize(groupSpeed)}/s
                  </span>
                )}
              </div>
            ) : (
              <span>{t('home.upload.pending') || '排队中...'}</span>
            )}
          </div>

          <div className="flex items-center space-x-2 font-mono tabular-nums text-slate-400 shrink-0">
            <span className="w-8 text-right font-medium">{groupProgress}%</span>

            <div className="flex items-center space-x-1">
              {isUploading && (
                <button
                  onClick={onPauseGroup}
                  title={t('home.transfer.pause') || '暂停整组上传'}
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <Pause className="h-3 w-3" />
                </button>
              )}

              {isPaused && (
                <button
                  onClick={onResumeGroup}
                  title={t('home.transfer.resume') || '继续整组上传'}
                  className="rounded p-0.5 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/60 transition-colors cursor-pointer"
                >
                  <Play className="h-3 w-3" />
                </button>
              )}

              {hasError && (
                <button
                  onClick={onResumeGroup}
                  title={t('home.transfer.retry') || '重试整组失败任务'}
                  className="rounded p-0.5 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/60 transition-colors cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              )}

              <button
                onClick={onRemoveGroup}
                title={t('home.transfer.delete') || '删除整组任务'}
                className="rounded p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/60 dark:hover:text-rose-400 transition-colors cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Folder Input for Group Rebind */}
      <input
        ref={groupFolderInputRef}
        type="file"
        multiple
        {...({ webkitdirectory: '', directory: '' } as any)}
        className="hidden"
        onChange={handleFolderRebind}
      />

      {/* Hidden File Input for Single File Rebind */}
      <input
        ref={singleFileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0] && activeSingleTaskId) {
            rebindTaskFile(activeSingleTaskId, e.target.files[0])
            notify.success(`已重新关联文件：${e.target.files[0].name}`)
          }
          setActiveSingleTaskId(null)
          e.target.value = ''
        }}
      />

      {/* Sub-Files List (Scrollable inside the card) */}
      {isExpanded && tasks.length > 0 && (
        <div className="max-h-48 overflow-y-auto px-2.5 py-1.5 space-y-1 divide-y divide-slate-100 dark:divide-slate-800/40">
          {tasks.map((task) => {
            const isSubSuccess = task.status === 'success'
            const isSubUploading =
              task.status === 'uploading' ||
              task.status === 'hashing' ||
              task.status === 'backending'
            const isSubMissing = !task.file && !isSubSuccess

            return (
              <div
                key={task.id}
                className="group relative flex items-center justify-between py-1.5 px-1.5 rounded-lg hover:bg-slate-100/70 dark:hover:bg-slate-800/50 text-[11px] text-slate-600 dark:text-slate-300 transition-colors"
              >
                <div className="flex items-center space-x-2 truncate flex-1 min-w-0 pr-2">
                  {isSubSuccess ? (
                    <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                  ) : isSubUploading ? (
                    <Loader2 className="h-3 w-3 text-indigo-600 dark:text-indigo-400 animate-spin shrink-0" />
                  ) : task.status === 'paused' ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0 ml-0.5 mr-0.5" />
                  ) : isSubMissing ? (
                    <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />
                  ) : task.status === 'error' ? (
                    <X className="h-3 w-3 text-rose-500 shrink-0" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0 ml-0.5 mr-0.5" />
                  )}

                  <span
                    className={`truncate ${
                      isSubUploading ? 'font-medium text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'
                    }`}
                    title={task.relativePath || task.name}
                  >
                    {task.name}
                  </span>
                </div>

                <div className="relative flex items-center shrink-0 font-mono tabular-nums text-[10px]">
                  {/* Normal status column */}
                  <div className="flex items-center space-x-2 group-hover:opacity-0 transition-opacity">
                    <span className="w-14 text-right text-slate-400 dark:text-slate-500">
                      {getFileSize(task.size)}
                    </span>

                    <div className="w-10 text-right">
                      {isSubUploading && (
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                          {task.progress}%
                        </span>
                      )}
                      {isSubSuccess && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          已完成
                        </span>
                      )}
                      {task.status === 'paused' && (
                        <span className="text-amber-500 font-medium">
                          已暂停
                        </span>
                      )}
                      {task.status === 'pending' && !isSubUploading && (
                        <span className="text-slate-400">
                          等待中
                        </span>
                      )}
                      {task.status === 'error' && (
                        <span className="text-rose-500 font-medium">
                          失败
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Hover action buttons */}
                  <div className="absolute right-0 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isSubMissing && !isSubSuccess && (
                      <button
                        onClick={() => {
                          setActiveSingleTaskId(task.id)
                          singleFileInputRef.current?.click()
                        }}
                        className="text-amber-600 dark:text-amber-400 hover:underline cursor-pointer font-medium text-[10px] mr-1"
                        title="单独选择该文件"
                      >
                        重新选择
                      </button>
                    )}

                    {isSubUploading && (
                      <button
                        onClick={() => onPauseTask(task.id)}
                        title="暂停"
                        className="rounded p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200 cursor-pointer transition-colors"
                      >
                        <Pause className="h-3 w-3" />
                      </button>
                    )}
                    {task.status === 'paused' && (
                      <button
                        onClick={() => onResumeTask(task.id)}
                        title="继续"
                        className="rounded p-1 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-950/60 cursor-pointer transition-colors"
                      >
                        <Play className="h-3 w-3" />
                      </button>
                    )}
                    {(task.status === 'error' || task.status === 'canceled') && (
                      <button
                        onClick={() => onRetryTask(task.id)}
                        title="重试"
                        className="rounded p-1 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 dark:text-indigo-400 cursor-pointer transition-colors"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={() => onRemoveTask(task.id)}
                      title="删除"
                      className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/60 dark:hover:text-rose-400 cursor-pointer transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
