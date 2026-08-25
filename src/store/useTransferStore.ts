import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { CancelTokenSource } from 'axios'
import { downloadZip } from 'client-zip'
import { fsList, fsGet } from '~/utils/api'
import { getDownloadUrl } from '~/utils/link'
import { useObjStore } from './useObjStore'
import { useSettingsStore } from './useSettingsStore'
import {
  downloadWithMultiThread,
  readWithTimeout,
  deleteOpfsTaskFolder,
  cleanupOpfsTempFiles,
} from '~/utils/streamDownload'
import {
  dispatchUpload,
  UploadEngineType,
  getFileRelativePath,
} from '~/utils/upload'
import { Obj } from '~/types'

export type TransferType = 'upload' | 'download' | 'package'

export type TransferStatus =
  | 'pending'
  | 'hashing'
  | 'uploading'
  | 'backending'
  | 'downloading'
  | 'processing'
  | 'paused'
  | 'success'
  | 'error'
  | 'canceled'

export interface PackageSubFile {
  id: string
  name: string
  path: string
  size: number
  status: 'pending' | 'downloading' | 'success' | 'error'
  progress: number
  directUrl?: string
  proxyUrl?: string
  modified?: string
}

export interface TransferTask {
  id: string
  type: TransferType
  name: string
  size: number
  targetDir?: string
  targetPath?: string
  relativePath?: string
  password?: string
  status: TransferStatus
  progress: number
  loaded: number
  speed: number // bytes per second
  error?: string
  createdAt?: number
  // Upload specific
  file?: File
  uploadEngine?: UploadEngineType
  cancelSource?: CancelTokenSource
  // Download specific
  url?: string
  abortController?: AbortController
  // Package specific
  subFiles?: PackageSubFile[]
  phase?: 'hashing' | 'uploading' | 'backending' | 'scanning' | 'downloading' | 'packaging' | 'success' | 'error' | 'canceled' | 'paused'
  completedFilesCount?: number
  totalFilesCount?: number
  targets?: Obj[]
}

interface TransferState {
  tasks: TransferTask[]
  isOpen: boolean
  isMinimized: boolean
  maxConcurrency: number
  maxDownloadConcurrency: number
  uploadChunkThreads: number
  downloadChunkThreads: number
  tryRapidUpload: boolean
  overwritePolicy: 'overwrite' | 'skip'

  addUploadFiles: (files: File[], targetDir: string, password?: string) => void
  addDownloadTask: (name: string, size: number, url: string, targetPath?: string) => void
  addDownloadTasks: (items: Array<{ name: string; size: number; url: string; targetPath?: string }>) => void
  addPackageTask: (targets: Obj[], currentPath?: string, password?: string) => Promise<void>
  pauseTask: (id: string) => void
  resumeTask: (id: string) => void
  pauseAll: () => void
  resumeAll: () => void
  cancelTask: (id: string) => void
  removeTask: (id: string) => void
  retryTask: (id: string) => void
  clearCompleted: () => void
  toggleOpen: () => void
  setOpen: (open: boolean) => void
  toggleMinimized: () => void
  setMinimized: (minimized: boolean) => void
  setMaxConcurrency: (max: number) => void
  setMaxDownloadConcurrency: (max: number) => void
  setUploadChunkThreads: (threads: number) => void
  setDownloadChunkThreads: (threads: number) => void
  setTryRapidUpload: (enabled: boolean) => void
  setOverwritePolicy: (policy: 'overwrite' | 'skip') => void

  // Backward compatibility alias
  addFiles: (files: File[], targetDir: string, password?: string) => void
}

let isProcessingUpload = false
let isProcessingDownload = false
let isProcessingPackage = false

function getSafeSubFileId(index: number, path: string): string {
  let hash = 0
  for (let i = 0; i < path.length; i++) {
    hash = (hash << 5) - hash + path.charCodeAt(i)
    hash |= 0
  }
  return `sf_${index}_${Math.abs(hash).toString(36)}`
}

export const useTransferStore = create<TransferState>()(
  persist(
    (set, get) => ({
      tasks: [],
      isOpen: false,
      isMinimized: false,
      maxConcurrency: 5,
      maxDownloadConcurrency: 5,
      uploadChunkThreads: 5,
      downloadChunkThreads: 5,
      tryRapidUpload: true,
      overwritePolicy: 'overwrite',

      setMaxConcurrency: (maxConcurrency) => set({ maxConcurrency }),
      setMaxDownloadConcurrency: (maxDownloadConcurrency) => set({ maxDownloadConcurrency }),
      setUploadChunkThreads: (uploadChunkThreads) => set({ uploadChunkThreads }),
      setDownloadChunkThreads: (downloadChunkThreads) => set({ downloadChunkThreads }),
      setTryRapidUpload: (tryRapidUpload) => set({ tryRapidUpload }),
      setOverwritePolicy: (overwritePolicy) => set({ overwritePolicy }),

      addUploadFiles: (files, targetDir, password = '') => {
        if (!files.length) return

        const normalizedDir = targetDir.endsWith('/') ? targetDir : targetDir + '/'
        const newTasks: TransferTask[] = files.map((file) => {
          const id = `up-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
          const relPath = getFileRelativePath(file)
          const targetPath = normalizedDir === '/' ? `/${relPath}` : `${normalizedDir}${relPath}`

          return {
            id,
            type: 'upload',
            file,
            name: file.name,
            relativePath: relPath,
            size: file.size,
            targetDir,
            targetPath,
            password,
            status: 'pending',
            phase: 'uploading',
            progress: 0,
            loaded: 0,
            speed: 0,
            createdAt: Date.now(),
          }
        })

        set((state) => ({
          tasks: [...state.tasks, ...newTasks],
          isOpen: true,
          isMinimized: false,
        }))

        processUploadQueue()
      },

      addDownloadTask: (name: string, size: number, url: string, targetPath?: string) => {
        get().addDownloadTasks([{ name, size, url, targetPath }])
      },

      addDownloadTasks: (items: Array<{ name: string; size: number; url: string; targetPath?: string }>) => {
        if (!items.length) return

        const newTasks: TransferTask[] = items.map((item) => ({
          id: `dl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: 'download',
          name: item.name,
          size: item.size,
          url: item.url,
          targetPath: item.targetPath,
          status: 'pending',
          progress: 0,
          loaded: 0,
          speed: 0,
          createdAt: Date.now(),
        }))

        set((state) => ({
          tasks: [...state.tasks, ...newTasks],
          isOpen: true,
          isMinimized: false,
        }))

        processDownloadQueue()
      },

      addPackageTask: async (targets: Obj[], currentPath: string = '/', password = '') => {
        if (!targets.length) return

        const archiveName =
          targets.length === 1
            ? `${targets[0].name}.zip`
            : `${currentPath.replace(/\/+$/, '').split('/').pop() || 'archive'}.zip`

        const id = `pkg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

        const newTask: TransferTask = {
          id,
          type: 'package',
          name: archiveName,
          size: 0,
          targetDir: currentPath,
          password,
          targets,
          status: 'pending',
          phase: 'scanning',
          progress: 0,
          loaded: 0,
          speed: 0,
          subFiles: [],
          completedFilesCount: 0,
          totalFilesCount: 0,
          createdAt: Date.now(),
        }

        set((state) => ({
          tasks: [...state.tasks, newTask],
          isOpen: true,
          isMinimized: false,
        }))

        processPackageQueue()
      },

      pauseTask: (id) => {
        const task = get().tasks.find((t) => t.id === id)
        if (task) {
          if (task.cancelSource) {
            task.cancelSource.cancel('Paused by user')
          }
          if (task.abortController) {
            task.abortController.abort()
          }
        }

        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: 'paused',
                  phase: t.type === 'package' ? 'paused' : t.phase,
                  speed: 0,
                  subFiles: t.subFiles?.map((sf) =>
                    sf.status === 'downloading' ? { ...sf, status: 'pending' } : sf
                  ),
                }
              : t
          ),
        }))

        processUploadQueue()
        processDownloadQueue()
        processPackageQueue()
      },

      resumeTask: (id) => {
        const task = get().tasks.find((t) => t.id === id)
        if (!task) return

        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: 'pending',
                  phase: t.type === 'package' ? (t.subFiles && t.subFiles.length > 0 ? 'downloading' : 'scanning') : t.phase,
                  speed: 0,
                  error: undefined,
                }
              : t
          ),
        }))

        if (task.type === 'upload') processUploadQueue()
        else if (task.type === 'download') processDownloadQueue()
        else if (task.type === 'package') processPackageQueue()
      },

      pauseAll: () => {
        const activeTasks = get().tasks.filter(
          (t) =>
            t.status === 'downloading' ||
            t.status === 'uploading' ||
            t.status === 'processing' ||
            t.status === 'pending'
        )
        activeTasks.forEach((t) => get().pauseTask(t.id))
      },

      resumeAll: () => {
        const pausedTasks = get().tasks.filter(
          (t) => t.status === 'paused' || t.status === 'error' || t.status === 'canceled'
        )
        pausedTasks.forEach((t) => get().resumeTask(t.id))
      },

      retryTask: (id) => {
        get().resumeTask(id)
      },

      cancelTask: (id) => {
        const task = get().tasks.find((t) => t.id === id)
        if (task) {
          if (task.cancelSource) {
            task.cancelSource.cancel('User cancelled')
          }
          if (task.abortController) {
            task.abortController.abort()
          }
        }

        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: 'canceled',
                  phase: 'canceled',
                  speed: 0,
                  subFiles: t.subFiles?.map((sf) =>
                    sf.status === 'downloading' ? { ...sf, status: 'pending' } : sf
                  ),
                }
              : t
          ),
        }))

        processUploadQueue()
        processDownloadQueue()
        processPackageQueue()
      },

      removeTask: (id) => {
        get().cancelTask(id)
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
        }))
        deleteOpfsTaskFolder(`dl_task_${id}`)
        deleteOpfsTaskFolder(`pkg_task_${id}`)
      },

      clearCompleted: () => {
        set((state) => ({
          tasks: state.tasks.filter(
            (t) => t.status !== 'success' && t.status !== 'canceled'
          ),
        }))
      },

      toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
      setOpen: (isOpen) => set({ isOpen }),
      toggleMinimized: () => set((state) => ({ isMinimized: !state.isMinimized })),
      setMinimized: (isMinimized) => set({ isMinimized }),

      // Alias for backward compatibility
      addFiles: (files, targetDir, password) =>
        get().addUploadFiles(files, targetDir, password),
    }),
    {
      name: 'openlist_transfers_v2',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        tasks: state.tasks.map((t) => {
          const { file, cancelSource, abortController, ...rest } = t
          const restoredStatus: TransferStatus =
            t.status === 'downloading' ||
            t.status === 'processing' ||
            t.status === 'uploading' ||
            t.status === 'hashing' ||
            t.status === 'backending'
              ? 'paused'
              : t.status

          const restoredSubFiles = t.subFiles?.map((sf) =>
            sf.status === 'downloading' ? { ...sf, status: 'pending' as const } : sf
          )

          return {
            ...rest,
            status: restoredStatus,
            phase:
              t.type === 'package' &&
              (t.phase === 'downloading' || t.phase === 'scanning' || t.phase === 'packaging')
                ? 'paused'
                : t.phase,
            subFiles: restoredSubFiles,
            speed: 0,
          }
        }),
        isOpen: state.isOpen || state.tasks.length > 0,
        isMinimized: state.isMinimized,
        maxConcurrency: state.maxConcurrency,
        maxDownloadConcurrency: state.maxDownloadConcurrency,
        uploadChunkThreads: state.uploadChunkThreads,
        downloadChunkThreads: state.downloadChunkThreads,
        tryRapidUpload: state.tryRapidUpload,
        overwritePolicy: state.overwritePolicy,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (state && state.tasks && state.tasks.length > 0) {
            // Auto open transfer window if there are active / paused tasks
            useTransferStore.setState({
              isOpen: true,
            })
            // Clean up old temporary files excluding currently active tasks
            const activeFolderNames = new Set(
              state.tasks.flatMap((t) => [`dl_task_${t.id}`, `pkg_task_${t.id}`])
            )
            cleanupOpfsTempFiles(24 * 60 * 60 * 1000, activeFolderNames)
          } else {
            cleanupOpfsTempFiles()
          }
        }
      },
    }
  )
)

// Export alias
export const useUploadStore = useTransferStore

/**
 * Worker queue processing package tasks
 */
async function processPackageQueue() {
  if (isProcessingPackage) return
  isProcessingPackage = true

  try {
    const store = useTransferStore.getState()
    const activePackages = store.tasks.filter(
      (t) => t.type === 'package' && (t.status === 'downloading' || t.status === 'processing')
    )

    if (activePackages.length >= 1) {
      isProcessingPackage = false
      return
    }

    const pendingTask = store.tasks.find((t) => t.type === 'package' && t.status === 'pending')
    if (!pendingTask) {
      isProcessingPackage = false
      return
    }

    await executePackageTask(pendingTask)
  } finally {
    isProcessingPackage = false
  }
}

async function executePackageTask(task: TransferTask) {
  const id = task.id
  const abortController = new AbortController()

  useTransferStore.setState((state) => ({
    tasks: state.tasks.map((t) =>
      t.id === id ? { ...t, abortController, status: 'downloading', error: undefined } : t
    ),
  }))

  const isOpfsSupported =
    typeof navigator !== 'undefined' &&
    'storage' in navigator &&
    typeof navigator.storage?.getDirectory === 'function'

  let rootDir: FileSystemDirectoryHandle | null = null
  let tempPkgDir: FileSystemDirectoryHandle | null = null
  const tempFolderName = `pkg_task_${id}`
  const memoryBlobs = new Map<string, Blob>()

  try {
    if (isOpfsSupported) {
      try {
        rootDir = await navigator.storage.getDirectory()
        tempPkgDir = await rootDir.getDirectoryHandle(tempFolderName, { create: true })
      } catch (_) {}
    }

    let currentSubFiles: PackageSubFile[] = task.subFiles && task.subFiles.length > 0 ? [...task.subFiles] : []
    let totalSize = task.size || 0

    // 1. If subFiles not yet collected (first time run), traverse folder!
    if (currentSubFiles.length === 0) {
      useTransferStore.setState((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id ? { ...t, phase: 'scanning', status: 'processing' } : t
        ),
      }))

      const currentPath = task.targetDir || '/'
      const password = task.password || ''
      const targets = task.targets || []
      const collected: PackageSubFile[] = []

      const traverse = async (subDir: string, obj: Obj): Promise<void> => {
        if (abortController.signal.aborted) return
        const activeFolder = subDir ? `${currentPath.replace(/\/$/, '')}/${subDir}` : currentPath

        if (!obj.is_dir) {
          const relativePath = subDir ? `${subDir}/${obj.name}` : obj.name
          const sfId = getSafeSubFileId(collected.length, relativePath)
          collected.push({
            id: sfId,
            name: obj.name,
            path: relativePath,
            size: obj.size || 0,
            status: 'pending',
            progress: 0,
            directUrl: getDownloadUrl(obj, activeFolder, 'direct'),
            proxyUrl: getDownloadUrl(obj, activeFolder, 'proxy'),
            modified: obj.modified,
          })
          totalSize += obj.size || 0
        } else {
          const nextFolder = `${activeFolder.replace(/\/$/, '')}/${obj.name}`
          const resp = await fsList(nextFolder, password)
          if (resp.code !== 200) {
            throw new Error(resp.message || `Failed to read folder: ${obj.name}`)
          }
          for (const child of resp.data?.content || []) {
            const nextSub = subDir ? `${subDir}/${obj.name}` : obj.name
            await traverse(nextSub, child)
          }
        }
      }

      for (const target of targets) {
        await traverse('', target)
      }

      if (abortController.signal.aborted) return
      if (collected.length === 0) {
        throw new Error('未找到可打包的文件')
      }

      currentSubFiles = collected
    }

    // Check OPFS disk for already completed subfiles (for resuming / pause resume)
    let alreadyCompletedCount = 0
    let initialDownloadedBytes = 0

    if (tempPkgDir) {
      for (let i = 0; i < currentSubFiles.length; i++) {
        const sf = currentSubFiles[i]
        try {
          const sfHandle = await tempPkgDir.getFileHandle(sf.id)
          const existingFile = await sfHandle.getFile()
          if (existingFile.size >= sf.size && sf.size > 0) {
            currentSubFiles[i] = { ...sf, status: 'success', progress: 100 }
            alreadyCompletedCount++
            initialDownloadedBytes += sf.size
          } else if (sf.size === 0) {
            currentSubFiles[i] = { ...sf, status: 'success', progress: 100 }
            alreadyCompletedCount++
          }
        } catch (_) {}
      }
    }

    // Update task in store with subFiles & progress
    const initialOverallProgress =
      totalSize > 0 ? Math.min(99, Math.round((initialDownloadedBytes / totalSize) * 100)) : 0

    useTransferStore.setState((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              size: totalSize,
              totalFilesCount: currentSubFiles.length,
              completedFilesCount: alreadyCompletedCount,
              loaded: initialDownloadedBytes,
              progress: initialOverallProgress,
              subFiles: [...currentSubFiles],
              phase: 'downloading',
              status: 'downloading',
            }
          : t
      ),
    }))

    // Write/update manifest.json
    if (tempPkgDir) {
      try {
        const manifestHandle = await tempPkgDir.getFileHandle('manifest.json', { create: true })
        const writable = await manifestHandle.createWritable()
        await writable.write(
          JSON.stringify({
            id,
            name: task.name,
            totalSize,
            createdAt: task.createdAt || Date.now(),
            filesCount: currentSubFiles.length,
          })
        )
        await writable.close()
      } catch (_) {}
    }

    let downloadedBytesTotal = initialDownloadedBytes
    let lastTime = Date.now()
    let lastBytes = downloadedBytesTotal

    // Direct stream fetcher with dynamic refresh
    const fetchFileStream = async (file: PackageSubFile): Promise<Response> => {
      let fetchUrl = file.directUrl || ''
      let response = await fetch(fetchUrl, { signal: abortController.signal })

      // If 403 or 401 or link expired, attempt refresh via /api/fs/get
      if ((response.status === 403 || response.status === 401) && task.targetDir) {
        try {
          const activeFolder = task.targetDir.replace(/\/$/, '')
          const fullPath = activeFolder === '/' ? `/${file.name}` : `${activeFolder}/${file.path}`
          const getRes = await fsGet(fullPath, task.password)
          if (getRes.code === 200 && getRes.data?.raw_url) {
            fetchUrl = getRes.data.raw_url
            response = await fetch(fetchUrl, { signal: abortController.signal })
          }
        } catch (_) {}
      }

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${file.name}`)
      return response
    }

    // Download single subfile with watchdog timeout and retry
    const downloadSubFile = async (file: PackageSubFile) => {
      if (abortController.signal.aborted) return
      if (file.status === 'success') return

      // Mark subfile as downloading
      useTransferStore.setState((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id && t.subFiles
            ? {
                ...t,
                subFiles: t.subFiles.map((sf) =>
                  sf.id === file.id ? { ...sf, status: 'downloading' } : sf
                ),
              }
            : t
        ),
      }))

      const maxRetries = 5
      let retryCount = 0

      while (retryCount < maxRetries) {
        if (abortController.signal.aborted) throw new Error('Packaging canceled')

        let opfsWritable: any = null

        try {
          if (tempPkgDir) {
            const fileHandle = await tempPkgDir.getFileHandle(file.id, { create: true })
            opfsWritable = await fileHandle.createWritable()
          }

          const response = await fetchFileStream(file)
          let fileLoadedBytes = 0

          if (response.body) {
            const reader = response.body.getReader()
            const memoryChunks: Uint8Array[] = []

            while (true) {
              if (abortController.signal.aborted) {
                if (opfsWritable) await opfsWritable.abort()
                throw new Error('Packaging canceled')
              }

              const { done, value } = await readWithTimeout(reader, 15000)
              if (done) break

              if (value) {
                if (opfsWritable) {
                  await opfsWritable.write(value)
                } else {
                  memoryChunks.push(value)
                }

                fileLoadedBytes += value.byteLength
                downloadedBytesTotal += value.byteLength

                const now = Date.now()
                const timeDelta = (now - lastTime) / 1000
                let currentSpeed = 0
                if (timeDelta >= 0.4) {
                  currentSpeed = Math.max(0, (downloadedBytesTotal - lastBytes) / timeDelta)
                  lastBytes = downloadedBytesTotal
                  lastTime = now
                }

                const overallProgress =
                  totalSize > 0
                    ? Math.min(99, Math.round((downloadedBytesTotal / totalSize) * 100))
                    : 0
                const fileProgress =
                  file.size > 0
                    ? Math.min(99, Math.round((fileLoadedBytes / file.size) * 100))
                    : 100

                useTransferStore.setState((state) => ({
                  tasks: state.tasks.map((t) =>
                    t.id === id
                      ? {
                          ...t,
                          loaded: downloadedBytesTotal,
                          progress: overallProgress,
                          speed: currentSpeed > 0 ? currentSpeed : t.speed,
                          subFiles: t.subFiles?.map((sf) =>
                            sf.id === file.id
                              ? { ...sf, progress: fileProgress }
                              : sf
                          ),
                        }
                      : t
                  ),
                }))
              }
            }

            if (opfsWritable) {
              await opfsWritable.close()
            } else {
              const blob = new Blob(memoryChunks as unknown as BlobPart[])
              memoryBlobs.set(file.id, blob)
            }
          } else {
            const blob = await response.blob()
            downloadedBytesTotal += file.size
            if (opfsWritable) {
              await opfsWritable.write(blob)
              await opfsWritable.close()
            } else {
              memoryBlobs.set(file.id, blob)
            }
          }

          // Mark completed subfile as success
          useTransferStore.setState((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === id
                ? {
                    ...t,
                    completedFilesCount: (t.completedFilesCount || 0) + 1,
                    subFiles: t.subFiles?.map((sf) =>
                      sf.id === file.id
                        ? { ...sf, status: 'success', progress: 100 }
                        : sf
                    ),
                  }
                : t
            ),
          }))

          return // Finished subfile successfully
        } catch (err: any) {
          if (opfsWritable) {
            try {
              await opfsWritable.close()
            } catch (_) {}
          }
          if (abortController.signal.aborted) throw err

          retryCount++
          if (retryCount >= maxRetries) {
            throw new Error(`Subfile ${file.name} failed after ${maxRetries} retries: ${err.message}`)
          }

          const delayMs = Math.round(1000 * Math.pow(1.8, retryCount - 1))
          await new Promise((r) => setTimeout(r, delayMs))
        }
      }
    }

    // Concurrently run 3 workers to download remaining subfiles
    const pendingFiles = currentSubFiles.filter((f) => f.status !== 'success')
    const CONCURRENCY = Math.min(3, Math.max(1, pendingFiles.length))
    let fileCursor = 0

    const worker = async () => {
      while (fileCursor < pendingFiles.length) {
        if (abortController.signal.aborted) return
        const currentIndex = fileCursor++
        const file = pendingFiles[currentIndex]
        await downloadSubFile(file)
      }
    }

    const workers = Array.from({ length: CONCURRENCY }, () => worker())
    await Promise.all(workers)

    if (abortController.signal.aborted) return

    // All subfiles downloaded locally, now start instant local packaging!
    useTransferStore.setState((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, phase: 'packaging', status: 'processing', speed: 0 } : t
      ),
    }))

    async function* generateLocalZipEntries() {
      for (const file of currentSubFiles) {
        if (tempPkgDir) {
          const handle = await tempPkgDir.getFileHandle(file.id)
          const fileBlob = await handle.getFile()
          yield {
            name: file.path,
            input: fileBlob,
            lastModified: file.modified ? new Date(file.modified) : new Date(),
          }
        } else {
          const fileBlob = memoryBlobs.get(file.id) || new Blob([])
          yield {
            name: file.path,
            input: fileBlob,
            lastModified: file.modified ? new Date(file.modified) : new Date(),
          }
        }
      }
    }

    const zipResponse = downloadZip(generateLocalZipEntries())
    const zipBlob = await zipResponse.blob()

    if (abortController.signal.aborted) return

    // Save ZIP file to disk
    const blobUrl = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = task.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000)

    // Clean up OPFS temporary folder after successful packaging
    if (rootDir) {
      try {
        await rootDir.removeEntry(tempFolderName, { recursive: true })
      } catch (_) {}
    }

    useTransferStore.setState((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              status: 'success',
              phase: 'success',
              progress: 100,
              speed: 0,
            }
          : t
      ),
    }))
  } catch (err: any) {
    if (abortController.signal.aborted) {
      useTransferStore.setState((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id
            ? {
                ...t,
                status: t.status === 'paused' ? 'paused' : 'canceled',
                phase: t.status === 'paused' ? 'paused' : 'canceled',
                speed: 0,
                subFiles: t.subFiles?.map((sf) =>
                  sf.status === 'downloading' ? { ...sf, status: 'pending' } : sf
                ),
              }
            : t
        ),
      }))
    } else {
      useTransferStore.setState((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id
            ? {
                ...t,
                status: 'error',
                phase: 'error',
                speed: 0,
                error: err.message || 'Packaging failed',
              }
            : t
        ),
      }))
    }
  } finally {
    processPackageQueue()
  }
}

/**
 * Worker queue processing uploads
 */
async function processUploadQueue() {
  if (isProcessingUpload) return
  isProcessingUpload = true

  try {
    const store = useTransferStore.getState()
    const activeUploads = store.tasks.filter(
      (t) => t.type === 'upload' && (t.status === 'uploading' || t.status === 'processing')
    )

    const maxUploadSlots =
      store.maxConcurrency ||
      parseInt(useSettingsStore.getState().getSetting('upload_task_threads_num', '5'), 10) ||
      5
    const availableSlots = maxUploadSlots - activeUploads.length
    if (availableSlots <= 0) {
      isProcessingUpload = false
      return
    }

    const pendingTasks = store.tasks.filter(
      (t) => t.type === 'upload' && t.status === 'pending'
    ).slice(0, availableSlots)

    if (pendingTasks.length === 0) {
      isProcessingUpload = false
      return
    }

    // Launch upload tasks
    pendingTasks.forEach((task) => {
      executeUploadTask(task)
    })
  } finally {
    isProcessingUpload = false
  }
}

async function executeUploadTask(task: TransferTask) {
  if (!task.file) {
    useTransferStore.setState((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: 'error',
              phase: 'error',
              speed: 0,
              error: '文件句柄已失效，请重新选择文件上传',
            }
          : t
      ),
    }))
    return
  }

  const abortController = new AbortController()

  useTransferStore.setState((state) => ({
    tasks: state.tasks.map((t) =>
      t.id === task.id
        ? { ...t, status: 'uploading', abortController, error: undefined }
        : t
    ),
  }))

  try {
    const transferStore = useTransferStore.getState()
    const settingsStore = useSettingsStore.getState()
    const objStore = useObjStore.getState()

    const rapid =
      transferStore.tryRapidUpload &&
      settingsStore.getSettingBool('rapid_upload_enabled', true)
    const overwrite = transferStore.overwritePolicy !== 'skip'
    const directUploadTools = objStore.direct_upload_tools || []
    const multipartEnabled = settingsStore.getSettingBool('multipart_enabled', true)
    const multipartChunkSizeMB =
      parseInt(settingsStore.getSetting('multipart_chunk_size', '10'), 10) || 10
    const enableCdnFallback = settingsStore.getSettingBool('enable_cdn_upload_fallback', false)
    const directFallbackMinSizeMB =
      parseInt(settingsStore.getSetting('direct_fallback_min_size', '5'), 10) || 5
    const directFallbackMinSpeedKB =
      parseInt(settingsStore.getSetting('direct_fallback_min_speed', '100'), 10) || 100
    const directFallbackDurationSec =
      parseInt(settingsStore.getSetting('direct_fallback_duration', '5'), 10) || 5
    const chunkThreads =
      transferStore.uploadChunkThreads ||
      parseInt(settingsStore.getSetting('client_upload_threads_num', '5'), 10) ||
      5

    await dispatchUpload({
      targetPath: task.targetPath || `/${task.name}`,
      file: task.file,
      password: task.password,
      overwrite,
      rapid,
      directUploadTools,
      multipartEnabled,
      multipartChunkSizeMB,
      chunkThreads,
      enableCdnFallback,
      directFallbackMinSizeMB,
      directFallbackMinSpeedKB,
      directFallbackDurationSec,
      signal: abortController.signal,
      onProgress: (p) => {
        useTransferStore.setState((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === task.id
              ? {
                  ...t,
                  progress: p.progress !== undefined ? p.progress : t.progress,
                  loaded: p.loaded !== undefined ? p.loaded : t.loaded,
                  speed: p.speed !== undefined ? p.speed : t.speed,
                  status:
                    p.status === 'success'
                      ? 'success'
                      : t.status === 'paused'
                      ? 'paused'
                      : (p.status as TransferStatus) || t.status,
                  phase: (p.status as any) || t.phase,
                  uploadEngine: p.engine || t.uploadEngine,
                }
              : t
          ),
        }))
      },
    })

    useTransferStore.setState((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: 'success',
              phase: 'success',
              progress: 100,
              loaded: task.file?.size || t.size,
              speed: 0,
            }
          : t
      ),
    }))

    // Silently refresh file list if user is viewing target directory
    const currentPath = objStore.currentPath
    if (
      task.targetDir &&
      (currentPath === task.targetDir || currentPath === task.targetDir.replace(/\/$/, ''))
    ) {
      objStore.fetchPath(objStore.currentPath, objStore.password, true, false, objStore.page, true)
    }
  } catch (err: any) {
    if (abortController.signal.aborted || err?.message === 'Upload canceled') {
      useTransferStore.setState((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: t.status === 'paused' ? 'paused' : 'canceled',
                phase: t.status === 'paused' ? 'paused' : 'canceled',
                speed: 0,
              }
            : t
        ),
      }))
    } else {
      useTransferStore.setState((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: 'error',
                phase: 'error',
                speed: 0,
                error: err.response?.data?.message || err.message || 'Upload failed',
              }
            : t
        ),
      }))
    }
  } finally {
    processUploadQueue()
  }
}

/**
 * Worker queue processing downloads (with concurrency control)
 */
async function processDownloadQueue() {
  if (isProcessingDownload) return
  isProcessingDownload = true

  try {
    const store = useTransferStore.getState()
    const activeDownloads = store.tasks.filter(
      (t) => t.type === 'download' && (t.status === 'downloading' || t.status === 'processing')
    )

    const maxDownloadSlots =
      store.maxDownloadConcurrency ||
      parseInt(useSettingsStore.getState().getSetting('download_task_threads_num', '5'), 10) ||
      5
    const availableSlots = maxDownloadSlots - activeDownloads.length
    if (availableSlots <= 0) {
      isProcessingDownload = false
      return
    }

    const pendingTasks = store.tasks.filter(
      (t) => t.type === 'download' && t.status === 'pending'
    ).slice(0, availableSlots)

    if (pendingTasks.length === 0) {
      isProcessingDownload = false
      return
    }

    pendingTasks.forEach((task) => {
      executeDownloadTask(task)
    })
  } finally {
    isProcessingDownload = false
  }
}

async function executeDownloadTask(task: TransferTask) {
  if (!task.url && !task.targetPath) return

  const abortController = new AbortController()

  useTransferStore.setState((state) => ({
    tasks: state.tasks.map((t) =>
      t.id === task.id
        ? { ...t, status: 'downloading', abortController, error: undefined }
        : t
    ),
  }))

  try {
    let activeUrl = task.url || ''

    // Refresh direct URL if targetPath is available to avoid 403 expiration
    if (task.targetPath) {
      try {
        const res = await fsGet(task.targetPath, task.password)
        if (res.code === 200 && res.data?.raw_url) {
          activeUrl = res.data.raw_url
          const sep = activeUrl.includes('?') ? '&' : '?'
          activeUrl = `${activeUrl}${sep}download`
        }
      } catch (_) {}
    }

    const transferStore = useTransferStore.getState()
    const settingsStore = useSettingsStore.getState()
    const downloadThreads =
      transferStore.downloadChunkThreads ||
      parseInt(settingsStore.getSetting('client_download_threads_num', '5'), 10) ||
      5

    await downloadWithMultiThread({
      url: activeUrl,
      filename: task.name,
      taskId: task.id,
      threadCount: downloadThreads,
      signal: abortController.signal,
      onProgress: (p) => {
        useTransferStore.setState((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === task.id
              ? {
                  ...t,
                  progress: p.percent,
                  loaded: p.downloadedBytes,
                  speed: p.speed,
                  status: p.status === 'completed' ? 'success' : t.status === 'paused' ? 'paused' : 'downloading',
                }
              : t
          ),
        }))
      },
    })

    useTransferStore.setState((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === task.id
          ? { ...t, status: 'success', progress: 100, speed: 0 }
          : t
      ),
    }))
  } catch (err: any) {
    if (abortController.signal.aborted) {
      useTransferStore.setState((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === task.id ? { ...t, status: t.status === 'paused' ? 'paused' : 'canceled', speed: 0 } : t
        ),
      }))
    } else {
      useTransferStore.setState((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: 'error',
                speed: 0,
                error: err.message || 'Download failed',
              }
            : t
        ),
      }))
    }
  } finally {
    processDownloadQueue()
  }
}
