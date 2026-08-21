import { create } from 'zustand'
import axios, { CancelTokenSource } from 'axios'
import { fsStreamUpload, fsFormUpload } from '~/utils/api'
import { useObjStore } from './useObjStore'
import { notify } from '~/utils/notify'

export type UploadStatus =
  | 'pending'
  | 'uploading'
  | 'processing'
  | 'success'
  | 'error'
  | 'canceled'

export interface UploadTask {
  id: string
  file: File
  name: string
  size: number
  targetDir: string
  targetPath: string
  password?: string
  status: UploadStatus
  progress: number
  loaded: number
  speed: number // bytes per second
  error?: string
  cancelSource?: CancelTokenSource
}

interface UploadState {
  tasks: UploadTask[]
  isOpen: boolean
  isMinimized: boolean
  maxConcurrency: number

  addFiles: (files: File[], targetDir: string, password?: string) => void
  cancelTask: (id: string) => void
  retryTask: (id: string) => void
  clearCompleted: () => void
  toggleOpen: () => void
  setOpen: (open: boolean) => void
  toggleMinimized: () => void
  setMinimized: (minimized: boolean) => void
}

let isProcessing = false

export const useUploadStore = create<UploadState>((set, get) => ({
  tasks: [],
  isOpen: false,
  isMinimized: false,
  maxConcurrency: 2,

  addFiles: (files, targetDir, password = '') => {
    if (!files.length) return

    const normalizedDir = targetDir.endsWith('/') ? targetDir : targetDir + '/'
    const newTasks: UploadTask[] = files.map((file) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      const targetPath = normalizedDir === '/' ? `/${file.name}` : `${normalizedDir}${file.name}`

      return {
        id,
        file,
        name: file.name,
        size: file.size,
        targetDir,
        targetPath,
        password,
        status: 'pending',
        progress: 0,
        loaded: 0,
        speed: 0,
      }
    })

    set((state) => ({
      tasks: [...state.tasks, ...newTasks],
      isOpen: true,
      isMinimized: false,
    }))

    // Trigger queue worker
    processUploadQueue()
  },

  cancelTask: (id) => {
    const task = get().tasks.find((t) => t.id === id)
    if (task && task.cancelSource) {
      task.cancelSource.cancel('User cancelled')
    }

    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, status: 'canceled', speed: 0 } : t
      ),
    }))

    processUploadQueue()
  },

  retryTask: (id) => {
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              status: 'pending',
              progress: 0,
              loaded: 0,
              speed: 0,
              error: undefined,
              cancelSource: undefined,
            }
          : t
      ),
    }))

    processUploadQueue()
  },

  clearCompleted: () => {
    set((state) => ({
      tasks: state.tasks.filter(
        (t) => t.status !== 'success' && t.status !== 'canceled'
      ),
    }))
  },

  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
  setOpen: (open) => set({ isOpen: open }),
  toggleMinimized: () => set((state) => ({ isMinimized: !state.isMinimized })),
  setMinimized: (minimized) => set({ isMinimized: minimized }),
}))

/**
 * Queue Dispatcher: Runs concurrently up to maxConcurrency
 */
async function processUploadQueue() {
  if (isProcessing) return
  isProcessing = true

  try {
    const state = useUploadStore.getState()
    const activeTasks = state.tasks.filter(
      (t) => t.status === 'uploading' || t.status === 'processing'
    )
    const availableSlots = state.maxConcurrency - activeTasks.length

    if (availableSlots <= 0) {
      isProcessing = false
      return
    }

    const pendingTasks = state.tasks
      .filter((t) => t.status === 'pending')
      .slice(0, availableSlots)

    if (!pendingTasks.length) {
      isProcessing = false
      return
    }

    // Launch each pending task
    pendingTasks.forEach((task) => {
      runSingleUpload(task.id)
    })
  } finally {
    isProcessing = false
  }
}

/**
 * Executes a single upload task with speed measurement and fallback
 */
async function runSingleUpload(taskId: string) {
  const task = useUploadStore.getState().tasks.find((t) => t.id === taskId)
  if (!task || task.status !== 'pending') return

  const cancelSource = axios.CancelToken.source()

  useUploadStore.setState((state) => ({
    tasks: state.tasks.map((t) =>
      t.id === taskId
        ? { ...t, status: 'uploading', cancelSource, speed: 0, progress: 0 }
        : t
    ),
  }))

  let lastTimestamp = Date.now()
  let lastLoaded = 0

  const onProgress = (percent: number, loaded: number) => {
    const now = Date.now()
    const duration = (now - lastTimestamp) / 1000

    let currentSpeed = 0
    if (duration >= 0.5) {
      currentSpeed = Math.max(0, (loaded - lastLoaded) / duration)
      lastTimestamp = now
      lastLoaded = loaded
    }

    useUploadStore.setState((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: percent >= 100 ? 'processing' : 'uploading',
              progress: percent,
              loaded,
              speed: currentSpeed || t.speed,
            }
          : t
      ),
    }))
  }

  try {
    let resp = await fsStreamUpload(
      task.targetPath,
      task.file,
      task.password,
      true, // overwrite
      false,
      onProgress,
      cancelSource.token
    )

    // Fallback to Form upload if stream is rejected
    if (resp.code !== 200) {
      resp = await fsFormUpload(
        task.targetPath,
        task.file,
        task.password,
        true,
        false,
        onProgress,
        cancelSource.token
      )
    }

    if (resp.code === 200) {
      useUploadStore.setState((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === taskId
            ? { ...t, status: 'success', progress: 100, loaded: t.size, speed: 0 }
            : t
        ),
      }))

      // If user is currently in the same folder, refresh file list
      const currentPath = useObjStore.getState().currentPath
      if (currentPath === task.targetDir) {
        useObjStore.getState().fetchPath(currentPath)
      }
    } else {
      throw new Error(resp.message || 'Upload failed')
    }
  } catch (err: any) {
    if (
      axios.isCancel(err) ||
      err?.message === 'Request cancelled' ||
      err?.message === 'User cancelled' ||
      err?.code === -1
    ) {
      useUploadStore.setState((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === taskId ? { ...t, status: 'canceled', speed: 0 } : t
        ),
      }))
    } else {
      useUploadStore.setState((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === taskId
            ? { ...t, status: 'error', speed: 0, error: err.message || 'Upload failed' }
            : t
        ),
      }))
      notify.error(`${task.name}: ${err.message || 'Upload failed'}`)
    }
  } finally {
    // Continue processing remaining queue
    processUploadQueue()
  }
}
