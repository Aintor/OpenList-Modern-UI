import { r } from '~/utils/request'
import { UploadOptions, HashResult } from './types'

export const streamUpload = async (
  options: UploadOptions,
  hashes?: HashResult
): Promise<void> => {
  const {
    targetPath,
    file,
    password = '',
    overwrite = true,
    asTask = false,
    signal,
    onProgress,
  } = options

  let lastTime = Date.now()
  let lastLoaded = 0

  const headers: Record<string, any> = {
    'File-Path': encodeURIComponent(targetPath),
    'As-Task': asTask ? 'true' : 'false',
    'Content-Type': file.type || 'application/octet-stream',
    'Last-Modified': file.lastModified,
    Password: password,
    Overwrite: overwrite.toString(),
  }

  if (hashes) {
    if (hashes.md5) headers['X-File-Md5'] = hashes.md5
    if (hashes.sha1) headers['X-File-Sha1'] = hashes.sha1
    if (hashes.sha256) headers['X-File-Sha256'] = hashes.sha256
  }

  onProgress?.({ status: 'uploading', engine: 'stream', progress: 0, loaded: 0, speed: 0 })

  const resp: any = await r.put('/fs/put', file, {
    headers,
    signal,
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total) {
        const percent = Math.min(99, Math.round((progressEvent.loaded / progressEvent.total) * 100))
        const now = Date.now()
        const duration = (now - lastTime) / 1000

        let currentSpeed = 0
        if (duration >= 0.5) {
          const loadedDelta = progressEvent.loaded - lastLoaded
          currentSpeed = Math.max(0, loadedDelta / duration)
          lastTime = now
          lastLoaded = progressEvent.loaded
        }

        const isBackending = progressEvent.loaded >= progressEvent.total
        onProgress?.({
          progress: percent,
          loaded: progressEvent.loaded,
          speed: currentSpeed > 0 ? currentSpeed : undefined,
          status: isBackending ? 'backending' : 'uploading',
        })
      }
    },
  })

  if (resp && resp.code === 200) {
    onProgress?.({ progress: 100, loaded: file.size, speed: 0, status: 'success' })
  } else {
    throw new Error(resp?.message || 'Stream upload failed')
  }
}
