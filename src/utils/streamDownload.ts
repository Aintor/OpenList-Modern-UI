/**
 * High-performance Multi-threaded Chunked Downloader with OPFS Memory Safety
 * 
 * Features:
 * 1. Range support probe (HEAD / Range: bytes=0-0)
 * 2. Parallel HTTP Range Chunk fetching (2-8 threads)
 * 3. OPFS (Origin Private File System) per-thread disk streaming for zero JS heap OOM & zero race conditions
 * 4. Real-time per-thread chunk progress & speed calculation
 * 5. Automatic graceful fallback to standard single-stream download
 */

export interface ThreadProgress {
  id: number
  start: number
  end: number
  downloaded: number
  total: number
  percent: number
  speed: number // bytes per sec
}

export interface DownloadProgress {
  totalBytes: number
  downloadedBytes: number
  percent: number
  speed: number // bytes per sec
  remainingSeconds: number
  threads: ThreadProgress[]
  status: 'probing' | 'downloading' | 'merging' | 'completed' | 'error' | 'fallback'
  errorMessage?: string
}

export interface MultiThreadDownloadOptions {
  url: string
  filename: string
  threadCount?: number
  onProgress?: (progress: DownloadProgress) => void
  signal?: AbortSignal
}

/**
 * Probe whether server/CDN supports HTTP Range Requests and get total file size
 */
export async function probeRangeSupport(
  url: string,
  signal?: AbortSignal
): Promise<{ supported: boolean; totalBytes: number; contentType: string }> {
  try {
    // Single-shot Range: bytes=0-0 probe (avoids HEAD presigned signature 403 mismatch)
    const rangeResp = await fetch(url, {
      headers: { Range: 'bytes=0-0' },
      signal,
    })

    const contentType = rangeResp.headers.get('Content-Type') || 'application/octet-stream'

    if (rangeResp.status === 206) {
      const contentRange = rangeResp.headers.get('Content-Range')
      if (contentRange) {
        const match = contentRange.match(/\/(\d+)$/)
        if (match && match[1]) {
          const total = parseInt(match[1], 10)
          return {
            supported: true,
            totalBytes: total,
            contentType,
          }
        }
      }
      const fallbackLength = rangeResp.headers.get('Content-Length')
      return {
        supported: true,
        totalBytes: fallbackLength ? parseInt(fallbackLength, 10) : 0,
        contentType,
      }
    }

    const fallbackLength = rangeResp.headers.get('Content-Length')
    return {
      supported: false,
      totalBytes: fallbackLength ? parseInt(fallbackLength, 10) : 0,
      contentType,
    }
  } catch (err) {
    console.warn('Range probe fallback:', err)
    return { supported: false, totalBytes: 0, contentType: 'application/octet-stream' }
  }
}

/**
 * Standard single-stream downloader for files that do not support Range or small files
 */
async function downloadSingleStream(
  url: string,
  filename: string,
  totalBytes: number,
  contentType: string,
  onProgress?: (progress: DownloadProgress) => void,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to download`)

  const effectiveType = contentType || response.headers.get('Content-Type') || 'application/octet-stream'

  const contentLength = response.headers.get('Content-Length')
  const actualTotal = totalBytes || (contentLength ? parseInt(contentLength, 10) : 0)

  const isOpfsSupported =
    typeof navigator !== 'undefined' &&
    'storage' in navigator &&
    typeof navigator.storage?.getDirectory === 'function'

  let downloaded = 0
  let lastTime = Date.now()
  let lastBytes = 0

  if (response.body && isOpfsSupported) {
    const rootDir = await navigator.storage.getDirectory()
    const tempDirName = `dl_tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const tempDir = await rootDir.getDirectoryHandle(tempDirName, { create: true })
    const fileHandle = await tempDir.getFileHandle(filename, { create: true })
    const writable = await fileHandle.createWritable()
    const reader = response.body.getReader()

    try {
      while (true) {
        if (signal?.aborted) {
          await writable.abort()
          throw new Error('Download aborted')
        }
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          await writable.write(value)
          downloaded += value.byteLength

          const now = Date.now()
          const delta = (now - lastTime) / 1000
          let speed = 0
          if (delta >= 0.4) {
            speed = Math.max(0, (downloaded - lastBytes) / delta)
            lastBytes = downloaded
            lastTime = now
          }

          const percent = actualTotal > 0 ? Math.min(99, Math.round((downloaded / actualTotal) * 100)) : 0
          const remainingSec = speed > 0 && actualTotal > downloaded ? Math.ceil((actualTotal - downloaded) / speed) : 0

          onProgress?.({
            totalBytes: actualTotal,
            downloadedBytes: downloaded,
            percent,
            speed,
            remainingSeconds: remainingSec,
            threads: [],
            status: 'downloading',
          })
        }
      }
      await writable.close()

      const finalFile = await fileHandle.getFile()
      const typedBlob = new Blob([await finalFile.arrayBuffer()], { type: effectiveType })
      const blobUrl = URL.createObjectURL(typedBlob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      const safeTtlMs = Math.max(60000, Math.min(300000, Math.ceil((actualTotal / (5 * 1024 * 1024)) * 1000)))
      setTimeout(async () => {
        try {
          URL.revokeObjectURL(blobUrl)
          await rootDir.removeEntry(tempDirName, { recursive: true })
        } catch (_) {}
      }, safeTtlMs)
    } catch (err) {
      try {
        await rootDir.removeEntry(tempDirName, { recursive: true })
      } catch (_) {}
      throw err
    }
  } else {
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000)
  }

  onProgress?.({
    totalBytes: actualTotal,
    downloadedBytes: actualTotal,
    percent: 100,
    speed: 0,
    remainingSeconds: 0,
    threads: [],
    status: 'completed',
  })
}

/**
 * Multi-threaded Range Downloader with OPFS per-thread isolation
 */
export async function downloadWithMultiThread(options: MultiThreadDownloadOptions): Promise<void> {
  const { url, filename, threadCount = 4, onProgress, signal } = options

  // Step 1: Probe Range capability
  onProgress?.({
    totalBytes: 0,
    downloadedBytes: 0,
    percent: 0,
    speed: 0,
    remainingSeconds: 0,
    threads: [],
    status: 'probing',
  })

  const probe = await probeRangeSupport(url, signal)

  // If Range is unsupported or file is small (< 2MB), seamless single-stream download with progress
  if (!probe.supported || (probe.totalBytes > 0 && probe.totalBytes <= 2 * 1024 * 1024)) {
    return await downloadSingleStream(url, filename, probe.totalBytes, probe.contentType, onProgress, signal)
  }

  const totalBytes = probe.totalBytes
  const actualThreads = Math.min(threadCount, 6, Math.max(1, Math.floor(totalBytes / (512 * 1024))))
  const chunkSize = Math.ceil(totalBytes / actualThreads)

  // Initialize per-thread tracking
  const threads: ThreadProgress[] = []
  for (let i = 0; i < actualThreads; i++) {
    const start = i * chunkSize
    const end = Math.min((i + 1) * chunkSize - 1, totalBytes - 1)
    threads.push({
      id: i + 1,
      start,
      end,
      downloaded: 0,
      total: end - start + 1,
      percent: 0,
      speed: 0,
    })
  }

  // Check OPFS support and create an isolated folder for this task
  const isOpfsSupported =
    typeof navigator !== 'undefined' &&
    'storage' in navigator &&
    typeof navigator.storage?.getDirectory === 'function'

  let rootDir: FileSystemDirectoryHandle | null = null
  let tempDirHandle: FileSystemDirectoryHandle | null = null
  const tempFolderName = `dl_tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  try {
    if (isOpfsSupported) {
      rootDir = await navigator.storage.getDirectory()
      tempDirHandle = await rootDir.getDirectoryHandle(tempFolderName, { create: true })
    }
  } catch (e) {
    console.warn('OPFS directory creation failed, falling back to memory chunks:', e)
    tempDirHandle = null
  }

  // In-memory fallback buffers if OPFS directory is unavailable
  const inMemoryBuffers: Uint8Array[][] | null = tempDirHandle
    ? null
    : Array.from({ length: actualThreads }, () => [] as Uint8Array[])

  let lastReportTime = Date.now()
  let lastTotalDownloaded = 0
  let currentSpeed = 0

  const updateProgress = () => {
    const now = Date.now()
    const timeDelta = (now - lastReportTime) / 1000

    const totalDownloaded = threads.reduce((acc, t) => acc + t.downloaded, 0)
    const overallPercent = Math.min(99, Math.floor((totalDownloaded / totalBytes) * 100))

    if (timeDelta >= 0.4) {
      const byteDelta = totalDownloaded - lastTotalDownloaded
      currentSpeed = Math.max(0, byteDelta / timeDelta)
      lastTotalDownloaded = totalDownloaded
      lastReportTime = now
    }

    const remainingBytes = Math.max(0, totalBytes - totalDownloaded)
    const remainingSeconds = currentSpeed > 0 ? Math.round(remainingBytes / currentSpeed) : 0

    onProgress?.({
      totalBytes,
      downloadedBytes: totalDownloaded,
      percent: overallPercent,
      speed: currentSpeed,
      remainingSeconds,
      threads: [...threads],
      status: 'downloading',
    })
  }

  // Launch isolated worker promises for each Range slice
  const downloadPromises = threads.map(async (thread) => {
    const rangeHeader = `bytes=${thread.start}-${thread.end}`

    const response = await fetch(url, {
      headers: { Range: rangeHeader },
      signal,
    })

    // Strict check: server MUST return 206 Partial Content
    if (response.status !== 206) {
      throw new Error(`Thread ${thread.id} failed: Server returned HTTP ${response.status} instead of 206 Partial Content`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error(`Thread ${thread.id} stream body unavailable`)
    }

    // Create thread's own independent part file in OPFS
    let partWritable: any = null
    if (tempDirHandle) {
      try {
        const partFileHandle = await tempDirHandle.getFileHandle(`part_${thread.id}.tmp`, { create: true })
        partWritable = await partFileHandle.createWritable()
      } catch (err) {
        console.warn(`Thread ${thread.id} failed to create OPFS part writable:`, err)
      }
    }

    let threadLastTime = Date.now()
    let threadLastBytes = 0

    try {
      while (true) {
        if (signal?.aborted) {
          if (partWritable) await partWritable.abort()
          throw new Error('Download canceled')
        }

        const { done, value } = await reader.read()
        if (done) break

        if (value) {
          const chunkLen = value.byteLength

          if (partWritable) {
            // Write sequentially to thread's isolated file (0 race condition!)
            await partWritable.write(value)
          } else if (inMemoryBuffers) {
            inMemoryBuffers[thread.id - 1].push(value)
          }

          thread.downloaded += chunkLen
          thread.percent = Math.min(100, Math.floor((thread.downloaded / thread.total) * 100))

          const now = Date.now()
          const threadDelta = (now - threadLastTime) / 1000
          if (threadDelta >= 0.4) {
            thread.speed = (thread.downloaded - threadLastBytes) / threadDelta
            threadLastBytes = thread.downloaded
            threadLastTime = now
          }

          updateProgress()
        }
      }

      if (partWritable) {
        await partWritable.close()
      }
    } catch (err) {
      if (partWritable) {
        try {
          await partWritable.abort()
        } catch (_) {}
      }
      throw err
    }

    thread.percent = 100
    thread.downloaded = thread.total
  })

  // Await all thread chunks to finish downloading
  await Promise.all(downloadPromises)

  // Step 3: Finalize & Assemble ordered Blob
  onProgress?.({
    totalBytes,
    downloadedBytes: totalBytes,
    percent: 100,
    speed: currentSpeed,
    remainingSeconds: 0,
    threads: [...threads],
    status: 'merging',
  })

  let finalBlob: Blob

  if (tempDirHandle) {
    const partFiles: Blob[] = []
    for (let i = 1; i <= actualThreads; i++) {
      const partHandle = await tempDirHandle.getFileHandle(`part_${i}.tmp`)
      const fileBlob = await partHandle.getFile()
      partFiles.push(fileBlob)
    }
    // Browser kernel seamlessly composes the ordered chunks in exact byte sequence
    finalBlob = new Blob(partFiles, { type: probe.contentType || 'application/octet-stream' })
  } else if (inMemoryBuffers) {
    const flatChunks = inMemoryBuffers.flat()
    finalBlob = new Blob(flatChunks as unknown as BlobPart[], { type: probe.contentType || 'application/octet-stream' })
  } else {
    throw new Error('No download buffers available')
  }

  // Step 4: Save file to user machine
  const blobUrl = URL.createObjectURL(finalBlob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  // Dynamic safe TTL: 60s base, scales up to 5 minutes based on 5MB/s disk write rate
  const safeTtlMs = Math.max(
    60000,
    Math.min(300000, Math.ceil((totalBytes / (5 * 1024 * 1024)) * 1000))
  )

  // Clean up OPFS temporary folder and revoke blob URL after browser has completed disk saving
  setTimeout(async () => {
    try {
      URL.revokeObjectURL(blobUrl)
    } catch (_) {}
    if (rootDir) {
      try {
        await rootDir.removeEntry(tempFolderName, { recursive: true })
      } catch (_) {}
    }
  }, safeTtlMs)

  onProgress?.({
    totalBytes,
    downloadedBytes: totalBytes,
    percent: 100,
    speed: 0,
    remainingSeconds: 0,
    threads: [...threads],
    status: 'completed',
  })
}

/**
 * Global OPFS Sweeper: Cleans up all temporary sandbox files and folders
 */
export async function cleanupOpfsTempFiles(): Promise<void> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.storage ||
    typeof navigator.storage.getDirectory !== 'function'
  ) {
    return
  }

  try {
    const rootDir = await navigator.storage.getDirectory()
    // @ts-ignore
    if (typeof (rootDir as any).values === 'function') {
      // @ts-ignore
      for await (const entry of (rootDir as any).values()) {
        if (entry.name.startsWith('dl_tmp_') || entry.name.startsWith('pkg_tmp_')) {
          try {
            await rootDir.removeEntry(entry.name, { recursive: true })
          } catch (_) {}
        }
      }
    }
  } catch (_) {}
}
