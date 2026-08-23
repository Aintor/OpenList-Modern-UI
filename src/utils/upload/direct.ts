import { r } from '~/utils/request'
import { UploadOptions, HttpDirectUploadInfo } from './types'

export class DirectUploadSlowError extends Error {
  constructor(message = 'Direct upload too slow') {
    super(message)
    this.name = 'DirectUploadSlowError'
  }
}

export const directUpload = async (options: UploadOptions): Promise<void> => {
  const {
    targetPath,
    file,
    overwrite = true,
    signal,
    onProgress,
    directFallbackMinSizeMB = 5,
    directFallbackMinSpeedKB = 100,
    directFallbackDurationSec = 5,
    enableCdnFallback = false,
  } = options

  // 1. Get direct upload info from backend
  const lastSlash = targetPath.lastIndexOf('/')
  const dirPath = lastSlash > 0 ? targetPath.slice(0, lastSlash) : '/'

  const resp: any = await r.post(
    '/fs/get_direct_upload_info',
    {
      path: dirPath,
      file_name: file.name,
      file_size: file.size,
      tool: 'HttpDirect',
    },
    {
      headers: {
        Overwrite: overwrite.toString(),
      },
      signal,
    }
  )

  const uploadInfo: HttpDirectUploadInfo = resp?.data
  if (!uploadInfo || !uploadInfo.upload_url) {
    throw new Error('HttpDirect upload not supported for this storage')
  }

  onProgress?.({ status: 'uploading', engine: 'direct', progress: 0, loaded: 0, speed: 0 })

  const chunkSize = uploadInfo.chunk_size || 0
  const uploadURL = uploadInfo.upload_url
  const method = uploadInfo.method || 'PUT'

  if (chunkSize > 0 && file.size > chunkSize) {
    await uploadChunked({
      file,
      uploadURL,
      chunkSize,
      method,
      headers: uploadInfo.headers,
      signal,
      onProgress,
      directFallbackMinSizeMB,
      directFallbackMinSpeedKB,
      directFallbackDurationSec,
      enableCdnFallback,
    })
  } else {
    await uploadSingle({
      file,
      uploadURL,
      method,
      headers: uploadInfo.headers,
      signal,
      onProgress,
      directFallbackMinSizeMB,
      directFallbackMinSpeedKB,
      directFallbackDurationSec,
      enableCdnFallback,
    })
  }

  onProgress?.({ progress: 100, loaded: file.size, speed: 0, status: 'success' })
}

interface SingleUploadParams {
  file: File
  uploadURL: string
  method: string
  headers?: Record<string, string>
  signal?: AbortSignal
  onProgress?: UploadOptions['onProgress']
  directFallbackMinSizeMB: number
  directFallbackMinSpeedKB: number
  directFallbackDurationSec: number
  enableCdnFallback: boolean
}

async function uploadSingle(params: SingleUploadParams): Promise<void> {
  const {
    file,
    uploadURL,
    method,
    headers,
    signal,
    onProgress,
    directFallbackMinSizeMB,
    directFallbackMinSpeedKB,
    directFallbackDurationSec,
    enableCdnFallback,
  } = params

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new Error('Upload canceled'))
    }

    const xhr = new XMLHttpRequest()
    let lastLoaded = 0
    let lastTime = Date.now()
    const startTime = Date.now()
    let slowCount = 0

    const onAbort = () => {
      xhr.abort()
      reject(new Error('Upload canceled'))
    }

    if (signal) {
      signal.addEventListener('abort', onAbort)
    }

    const cleanup = () => {
      if (signal) signal.removeEventListener('abort', onAbort)
    }

    // Connection watchdog: if 10s without any progress event
    const watchdogTimer = setTimeout(() => {
      if (lastLoaded === 0 && !signal?.aborted) {
        cleanup()
        xhr.abort()
        reject(new DirectUploadSlowError('Direct upload handshake timeout'))
      }
    }, 10000)

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        clearTimeout(watchdogTimer)
        const percent = Math.min(99, Math.round((e.loaded / e.total) * 100))
        const now = Date.now()
        const duration = (now - lastTime) / 1000

        let currentSpeed = 0
        if (duration >= 0.5) {
          currentSpeed = Math.max(0, (e.loaded - lastLoaded) / duration)
          lastLoaded = e.loaded
          lastTime = now

          // Low-speed detection logic after 4s warmup
          const elapsed = (now - startTime) / 1000
          if (
            enableCdnFallback &&
            elapsed >= 4 &&
            file.size >= directFallbackMinSizeMB * 1024 * 1024
          ) {
            const minSpeedBps = directFallbackMinSpeedKB * 1024
            if (currentSpeed < minSpeedBps) {
              slowCount += duration
              if (slowCount >= directFallbackDurationSec) {
                cleanup()
                xhr.abort()
                return reject(
                  new DirectUploadSlowError(
                    `Direct speed ${(currentSpeed / 1024).toFixed(1)} KB/s below threshold`
                  )
                )
              }
            } else {
              slowCount = 0
            }
          }
        }

        const isBackending = e.loaded >= e.total
        onProgress({
          progress: percent,
          loaded: e.loaded,
          speed: currentSpeed > 0 ? currentSpeed : undefined,
          status: isBackending ? 'backending' : 'uploading',
        })
      }
    })

    xhr.addEventListener('load', () => {
      cleanup()
      clearTimeout(watchdogTimer)
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`Direct upload failed with status ${xhr.status}`))
      }
    })

    xhr.addEventListener('error', () => {
      cleanup()
      clearTimeout(watchdogTimer)
      reject(new Error('Direct upload network or CORS error'))
    })

    xhr.open(method, uploadURL)

    if (headers) {
      Object.entries(headers).forEach(([k, v]) => {
        xhr.setRequestHeader(k, v)
      })
    }

    xhr.send(file)
  })
}

interface ChunkedUploadParams {
  file: File
  uploadURL: string
  chunkSize: number
  method: string
  headers?: Record<string, string>
  signal?: AbortSignal
  onProgress?: UploadOptions['onProgress']
  directFallbackMinSizeMB: number
  directFallbackMinSpeedKB: number
  directFallbackDurationSec: number
  enableCdnFallback: boolean
}

async function uploadChunked(params: ChunkedUploadParams): Promise<void> {
  const {
    file,
    uploadURL,
    chunkSize,
    method,
    headers,
    signal,
    onProgress,
    directFallbackMinSizeMB,
    directFallbackMinSpeedKB,
    directFallbackDurationSec,
    enableCdnFallback,
  } = params

  const totalChunks = Math.ceil(file.size / chunkSize)
  let uploadedBytes = 0
  let lastTime = Date.now()
  let lastLoadedSum = 0
  const startTime = Date.now()
  let slowCount = 0

  for (let i = 0; i < totalChunks; i++) {
    if (signal?.aborted) throw new Error('Upload canceled')

    const start = i * chunkSize
    const end = Math.min(start + chunkSize, file.size)
    const chunk = file.slice(start, end)

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      const onAbort = () => {
        xhr.abort()
        reject(new Error('Upload canceled'))
      }

      if (signal) {
        signal.addEventListener('abort', onAbort)
      }

      const cleanup = () => {
        if (signal) signal.removeEventListener('abort', onAbort)
      }

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const totalLoaded = uploadedBytes + e.loaded
          const percent = Math.min(99, Math.round((totalLoaded / file.size) * 100))
          const now = Date.now()
          const duration = (now - lastTime) / 1000

          let currentSpeed = 0
          if (duration >= 0.5) {
            currentSpeed = Math.max(0, (totalLoaded - lastLoadedSum) / duration)
            lastLoadedSum = totalLoaded
            lastTime = now

            // Low-speed detection
            const elapsed = (now - startTime) / 1000
            if (
              enableCdnFallback &&
              elapsed >= 4 &&
              file.size >= directFallbackMinSizeMB * 1024 * 1024
            ) {
              const minSpeedBps = directFallbackMinSpeedKB * 1024
              if (currentSpeed < minSpeedBps) {
                slowCount += duration
                if (slowCount >= directFallbackDurationSec) {
                  cleanup()
                  xhr.abort()
                  return reject(
                    new DirectUploadSlowError(
                      `Direct chunk speed ${(currentSpeed / 1024).toFixed(1)} KB/s below threshold`
                    )
                  )
                }
              } else {
                slowCount = 0
              }
            }
          }

          onProgress({
            progress: percent,
            loaded: totalLoaded,
            speed: currentSpeed > 0 ? currentSpeed : undefined,
            status: totalLoaded >= file.size ? 'backending' : 'uploading',
          })
        }
      })

      xhr.addEventListener('load', () => {
        cleanup()
        if (xhr.status >= 200 && xhr.status < 300) {
          uploadedBytes += chunk.size
          resolve()
        } else {
          reject(new Error(`Direct chunk ${i + 1} failed with status ${xhr.status}`))
        }
      })

      xhr.addEventListener('error', () => {
        cleanup()
        reject(new Error(`Direct chunk ${i + 1} network or CORS error`))
      })

      xhr.open(method, uploadURL)
      xhr.setRequestHeader('Content-Range', `bytes ${start}-${end - 1}/${file.size}`)

      if (headers) {
        Object.entries(headers).forEach(([k, v]) => {
          xhr.setRequestHeader(k, v)
        })
      }

      xhr.send(chunk)
    })
  }
}
