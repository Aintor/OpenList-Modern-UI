import React, { useEffect, useState } from 'react'
import { r } from '~/utils/request'
import { notify } from '~/utils/notify'
import { useT } from '~/lang'
import {
  ListFilter,
  RefreshCw,
  Trash2,
  Loader2,
} from 'lucide-react'

type TaskCategory = 'offline_download' | 'upload' | 'copy' | 'move' | 'decompress'

interface TaskItem {
  id: string
  name: string
  state: number
  status: string
  progress: number
  error?: string
  start_time?: string
  end_time?: string
}

export const TasksTab: React.FC = () => {
  const t = useT()
  const [category, setCategory] = useState<TaskCategory>('offline_download')
  const [doneStatus, setDoneStatus] = useState<'undone' | 'done'>('undone')
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(false)

  const categories: { id: TaskCategory; name: string }[] = [
    { id: 'offline_download', name: t('home.toolbar.offline_download') || 'Offline Download' },
    { id: 'upload', name: t('home.toolbar.upload') || 'Upload' },
    { id: 'copy', name: t('home.toolbar.copy') || 'Copy' },
    { id: 'move', name: t('home.toolbar.move') || 'Move' },
    { id: 'decompress', name: t('home.toolbar.decompress') || 'Decompress' },
  ]

  const fetchTasks = async () => {
    setLoading(true)
    try {
      const resp = await r.get<TaskItem[]>(`/task/${category}/${doneStatus}`)
      if (resp.code === 200 && resp.data) {
        setTasks(resp.data || [])
      } else {
        setTasks([])
      }
    } catch (e: any) {
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
    const timer = setInterval(fetchTasks, 3000)
    return () => clearInterval(timer)
  }, [category, doneStatus])

  const handleCancelOrDelete = async (taskId: string) => {
    const action = doneStatus === 'undone' ? 'cancel' : 'delete'
    try {
      const resp = await r.post(`/task/${category}/${action}?tid=${taskId}`)
      if (resp.code === 200) {
        notify.success(t('global.save_success') || 'Task updated')
        fetchTasks()
      }
    } catch (e) {
      notify.error('Action failed')
    }
  }

  const handleClearDone = async () => {
    try {
      const resp = await r.post(`/task/${category}/clear_done`)
      if (resp.code === 200) {
        notify.success(t('global.delete_success') || 'Completed tasks cleared')
        fetchTasks()
      }
    } catch (e) {
      notify.error('Action failed')
    }
  }

  return (
    <div className="space-y-4">
      {/* Category Pills & Done/Undone Tab */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3 dark:border-slate-800">
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                category === c.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex rounded-xl border border-slate-200/80 bg-slate-50 p-0.5 text-xs font-semibold dark:border-slate-800 dark:bg-slate-900">
            <button
              onClick={() => setDoneStatus('undone')}
              className={`rounded-lg px-3 py-1 transition-all ${
                doneStatus === 'undone'
                  ? 'bg-white shadow-xs text-indigo-600 dark:bg-slate-800 dark:text-indigo-400'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              {t('tasks.undone') || 'Running'}
            </button>
            <button
              onClick={() => setDoneStatus('done')}
              className={`rounded-lg px-3 py-1 transition-all ${
                doneStatus === 'done'
                  ? 'bg-white shadow-xs text-indigo-600 dark:bg-slate-800 dark:text-indigo-400'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              {t('tasks.done') || 'Completed'}
            </button>
          </div>

          {doneStatus === 'done' && (
            <button
              onClick={handleClearDone}
              className="flex items-center space-x-1 rounded-xl border border-rose-200 bg-rose-50/50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{t('tasks.clear_succeeded') || 'Clear Done'}</span>
            </button>
          )}

          <button
            onClick={fetchTasks}
            className="rounded-xl border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-2.5">
        {loading && tasks.length === 0 ? (
          <div className="flex h-48 items-center justify-center space-x-2 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            <span className="text-sm">{t('global.loading') || 'Loading task status...'}</span>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-400 dark:border-slate-800">
            <ListFilter className="h-10 w-10 text-slate-300 dark:text-slate-700 mb-2 stroke-[1.5]" />
            <p className="text-sm font-semibold">{t('global.empty') || 'No tasks in this queue'}</p>
          </div>
        ) : (
          tasks.map((task) => {
            const stateLabel = t(`tasks.state.${task.state}`) || task.status || 'Pending'

            return (
              <div
                key={task.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 gap-3"
              >
                <div className="flex-1 overflow-hidden space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="truncate text-xs font-bold text-slate-800 dark:text-slate-200">
                      {task.name}
                    </span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                        task.state === 2
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                          : task.state === 1
                          ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400'
                          : 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400'
                      }`}
                    >
                      {stateLabel}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="flex items-center space-x-2 pt-1">
                    <div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        style={{ width: `${task.progress || 0}%` }}
                        className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {Math.round(task.progress || 0)}%
                    </span>
                  </div>

                  {task.error && (
                    <p className="text-[11px] text-rose-500 font-mono pt-1 truncate">{task.error}</p>
                  )}
                </div>

                <div className="flex items-center justify-end space-x-2 shrink-0">
                  <button
                    onClick={() => handleCancelOrDelete(task.id)}
                    className="flex items-center space-x-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-rose-950/40 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{doneStatus === 'undone' ? t('global.cancel') || 'Cancel' : t('global.delete') || 'Delete'}</span>
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
