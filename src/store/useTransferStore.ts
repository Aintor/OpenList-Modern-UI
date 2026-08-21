import { create } from 'zustand'
import axios, { CancelTokenSource } from 'axios'
import { downloadZip } from 'client-zip'
import { fsStreamUpload, fsFormUpload, fsList } from '~/utils/api'
import { getDownloadUrl } from '~/utils/link'
import { useObjStore } from './useObjStore'
import { downloadWithMultiThread } from '~/utils/streamDownload'
import { Obj } from '~/types'

export type TransferType = 'upload' | 'download' | 'package'

export type TransferStatus =
  | 'pending'
  | 'uploading'
  | 'downloading'
  | 'processing'
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
  password?: string
  status: TransferStatus
  progress: number
  loaded: number
  speed: number // bytes per second
  error?: string
  // Upload specific
  file?: File
  cancelSource?: CancelTokenSource
  // Download specific
  url?: string
  abortController?: AbortController
  // Package specific
  subFiles?: PackageSubFile[]
  phase?: 'scanning' | 'downloading' | 'packaging' | 'success' | 'error' | 'canceled'
  completedFilesCount?: number
  totalFilesCount?: number
}

interface TransferState {
  tasks: TransferTask[]
  isOpen: boolean
  isMinimized: boolean
  maxConcurrency: number
  maxDownloadConcurrency: number

  addUploadFiles: (files: File[], targetDir: string, password?: string) => void
  addDownloadTask: (name: string, size: number, url: string) => void
  addDownloadTasks: (items: Array<{ name: string; size: number; url: string }>) => void
  addPackageTask: (targets: Obj[], currentPath?: string, password?: string) => Promise<void>
  cancelTask: (id: string) => void
  removeTask: (id: string) => void
  retryTask: (id: string) => void
  clearCompleted: () => void
  toggleOpen: () => void
  setOpen: (open: boolean) => void
  toggleMinimized: () => void
  setMinimized: (minimized: boolean) => void

  // Backward compatibility alias
  addFiles: (files: File[], targetDir: string, password?: string) => void
}

let isProcessingUpload = false
let isProcessingDownload = false

export const useTransferStore = create<TransferState>((set, get) => ({
  tasks: [],
  isOpen: false,
  isMinimized: false,
  maxConcurrency: 2,
  maxDownloadConcurrency: 3,

  addUploadFiles: (files, targetDir, password = '') => {
    if (!files.length) return

    const normalizedDir = targetDir.endsWith('/') ? targetDir : targetDir + '/'
    const newTasks: TransferTask[] = files.map((file) => {
      const id = `up-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const targetPath = normalizedDir === '/' ? `/${file.name}` : `${normalizedDir}${file.name}`

      return {
        id,
        type: 'upload',
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

    processUploadQueue()
  },

  addDownloadTask: (name: string, size: number, url: string) => {
    get().addDownloadTasks([{ name, size, url }])
  },

  addDownloadTasks: (items: Array<{ name: string; size: number; url: string }>) => {
    if (!items.length) return

    const newTasks: TransferTask[] = items.map((item) => ({
      id: `dl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'download',
      name: item.name,
      size: item.size,
      url: item.url,
      status: 'pending',
      progress: 0,
      loaded: 0,
      speed: 0,
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
    const abortController = new AbortController()

    const newTask: TransferTask = {
      id,
      type: 'package',
      name: archiveName,
      size: 0,
      status: 'processing',
      phase: 'scanning',
      progress: 0,
      loaded: 0,
      speed: 0,
      abortController,
      subFiles: [],
      completedFilesCount: 0,
      totalFilesCount: 0,
    }

    set((state) => ({
      tasks: [...state.tasks, newTask],
      isOpen: true,
      isMinimized: false,
    }))

    try {
      // 1. Recursive folder traversal
      const collected: PackageSubFile[] = []
      let totalSize = 0

      const traverse = async (subDir: string, obj: Obj): Promise<void> => {
        if (abortController.signal.aborted) return

        const activeFolder = subDir ? `${currentPath.replace(/\/$/, '')}/${subDir}` : currentPath

        if (!obj.is_dir) {
          const relativePath = subDir ? `${subDir}/${obj.name}` : obj.name
          collected.push({
            id: `f-${collected.length}-${Math.random().toString(36).slice(2, 5)}`,
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

      // Initialize OPFS sandbox directory
      const isOpfsSupported =
        typeof navigator !== 'undefined' &&
        'storage' in navigator &&
        typeof navigator.storage?.getDirectory === 'function'

      let rootDir: FileSystemDirectoryHandle | null = null
      let tempPkgDir: FileSystemDirectoryHandle | null = null
      const tempFolderName = `pkg_tmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      const memoryBlobs = new Map<string, Blob>()

      if (isOpfsSupported) {
        try {
          rootDir = await navigator.storage.getDirectory()
          tempPkgDir = await rootDir.getDirectoryHandle(tempFolderName, { create: true })
        } catch (_) {}
      }

      // Update task with discovered subFiles
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id
            ? {
                ...t,
                size: totalSize,
                totalFilesCount: collected.length,
                subFiles: [...collected],
                phase: 'downloading',
                status: 'downloading',
              }
            : t
        ),
      }))

      let downloadedBytesTotal = 0
      let lastTime = Date.now()
      let lastBytes = 0

      // Direct stream fetcher
      const fetchFileStream = async (file: PackageSubFile): Promise<Response> => {
        const fetchUrl = file.directUrl || ''
        const response = await fetch(fetchUrl, { signal: abortController.signal })
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${file.name}`)
        return response
      }

      // Worker downloading a single subfile directly to OPFS sandbox
      const downloadSubFile = async (file: PackageSubFile) => {
        if (abortController.signal.aborted) return

        // Mark this specific subfile as downloading
        set((state) => ({
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

        const response = await fetchFileStream(file)
        let fileLoadedBytes = 0

        let opfsWritable: any = null
        if (tempPkgDir) {
          try {
            const fileHandle = await tempPkgDir.getFileHandle(file.id, { create: true })
            opfsWritable = await fileHandle.createWritable()
          } catch (_) {}
        }

        if (response.body) {
          const reader = response.body.getReader()
          const memoryChunks: Uint8Array[] = []

          while (true) {
            if (abortController.signal.aborted) {
              if (opfsWritable) await opfsWritable.abort()
              throw new Error('Packaging canceled')
            }

            const { done, value } = await reader.read()
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

              const overallProgress = Math.min(
                99,
                Math.round((downloadedBytesTotal / (totalSize || 1)) * 100)
              )
              const fileProgress = Math.min(
                99,
                Math.round((fileLoadedBytes / (file.size || 1)) * 100)
              )

              set((state) => ({
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
        set((state) => ({
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
      }

      // Concurrently run 3 workers to download all subfiles in parallel
      const CONCURRENCY = Math.min(3, collected.length)
      let fileCursor = 0

      const worker = async () => {
        while (fileCursor < collected.length) {
          if (abortController.signal.aborted) return
          const currentIndex = fileCursor++
          const file = collected[currentIndex]
          await downloadSubFile(file)
        }
      }

      const workers = Array.from({ length: CONCURRENCY }, () => worker())
      await Promise.all(workers)

      if (abortController.signal.aborted) return

      // All subfiles downloaded locally, now start instant local packaging!
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id ? { ...t, phase: 'packaging', status: 'processing', speed: 0 } : t
        ),
      }))

      async function* generateLocalZipEntries() {
        for (const file of collected) {
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
      a.download = archiveName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000)

      // Clean up OPFS temporary folder
      if (rootDir) {
        try {
          await rootDir.removeEntry(tempFolderName, { recursive: true })
        } catch (_) {}
      }

      set((state) => ({
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
      } else {
        set((state) => ({
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
    }
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
  },

  removeTask: (id) => {
    get().cancelTask(id)
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    }))
  },

  retryTask: (id) => {
    const task = get().tasks.find((t) => t.id === id)
    if (!task) return

    if (task.type === 'download' && task.url) {
      get().removeTask(id)
      get().addDownloadTask(task.name, task.size, task.url)
      return
    }

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
            }
          : t
      ),
    }))

    processUploadQueue()
    processDownloadQueue()
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
}))

// Export alias
export const useUploadStore = useTransferStore

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

    const availableSlots = store.maxConcurrency - activeUploads.length
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
  if (!task.file) return

  const cancelSource = axios.CancelToken.source()

  useTransferStore.setState((state) => ({
    tasks: state.tasks.map((t) =>
      t.id === task.id
        ? { ...t, status: 'uploading', cancelSource }
        : t
    ),
  }))

  let lastLoaded = 0
  let lastTime = Date.now()

  try {
    const onUploadProgress = (percent: number, loaded: number, _total: number) => {
      const now = Date.now()
      const timeDelta = (now - lastTime) / 1000

      let speed = 0
      if (timeDelta >= 0.5) {
        const byteDelta = loaded - lastLoaded
        speed = Math.max(0, byteDelta / timeDelta)
        lastLoaded = loaded
        lastTime = now
      }

      useTransferStore.setState((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === task.id
            ? {
                ...t,
                progress: Math.min(99, percent),
                loaded,
                speed: speed > 0 ? speed : t.speed,
              }
            : t
        ),
      }))
    }

    const isSmall = task.file.size < 5 * 1024 * 1024
    let resp: any

    if (isSmall) {
      resp = await fsFormUpload(
        task.targetPath || `/${task.name}`,
        task.file,
        task.password,
        false,
        false,
        onUploadProgress,
        cancelSource.token
      )
    } else {
      resp = await fsStreamUpload(
        task.targetPath || `/${task.name}`,
        task.file,
        task.password,
        false,
        false,
        onUploadProgress,
        cancelSource.token
      )
    }

    if (resp.code === 200) {
      useTransferStore.setState((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: 'success',
                progress: 100,
                speed: 0,
              }
            : t
        ),
      }))

      // Refresh file list
      const objStore = useObjStore.getState()
      if (
        task.targetDir &&
        (objStore.currentPath === task.targetDir ||
          objStore.currentPath === task.targetDir.replace(/\/$/, ''))
      ) {
        objStore.fetchPath(objStore.currentPath, objStore.password, true)
      }
    } else {
      throw new Error(resp.message || 'Upload failed')
    }
  } catch (err: any) {
    if (axios.isCancel(err)) {
      useTransferStore.setState((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === task.id ? { ...t, status: 'canceled', speed: 0 } : t
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

    const availableSlots = (store.maxDownloadConcurrency || 3) - activeDownloads.length
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
  if (!task.url) return

  const abortController = new AbortController()

  useTransferStore.setState((state) => ({
    tasks: state.tasks.map((t) =>
      t.id === task.id
        ? { ...t, status: 'downloading', abortController }
        : t
    ),
  }))

  try {
    await downloadWithMultiThread({
      url: task.url,
      filename: task.name,
      threadCount: 4,
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
                  status: p.status === 'completed' ? 'success' : 'downloading',
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
          t.id === task.id ? { ...t, status: 'canceled', speed: 0 } : t
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
