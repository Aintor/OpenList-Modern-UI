import { UploadOptions, HashResult } from './types'
import { calculateHash } from './hash'
import { directUpload } from './direct'
import { multipartUpload } from './multipart'
import { streamUpload } from './stream'
import { formUpload } from './form'

export const dispatchUpload = async (options: UploadOptions): Promise<void> => {
  const {
    file,
    rapid = true,
    directUploadTools,
    multipartEnabled = true,
    multipartChunkSizeMB = 10,
    signal,
    onProgress,
  } = options

  if (signal?.aborted) throw new Error('Upload canceled')

  // 1. Rapid Upload (Web Worker Hash Calculation)
  let hashes: HashResult | undefined
  if (rapid) {
    onProgress?.({ status: 'hashing', progress: 0, speed: 0 })
    try {
      hashes = await calculateHash(
        file,
        (progress) => {
          onProgress?.({
            status: 'hashing',
            progress: Math.min(99, Math.round(progress)),
            speed: 0,
          })
        },
        signal
      )
    } catch (err: any) {
      if (signal?.aborted) throw err
      console.warn('Rapid hash calculation skipped/failed:', err)
    }
  }

  if (signal?.aborted) throw new Error('Upload canceled')

  // 2. Direct-First (HttpDirect)
  const isDirectSupported = directUploadTools?.includes('HttpDirect')
  if (isDirectSupported) {
    try {
      await directUpload(options)
      return
    } catch (err: any) {
      if (signal?.aborted) throw err
      console.warn('Direct upload failed or slow, silently falling back to backend pipeline:', err.message)
    }
  }

  if (signal?.aborted) throw new Error('Upload canceled')

  // 3. Universal Multipart (Large files)
  const fallbackThreshold = Math.max(1, multipartChunkSizeMB) * 1024 * 1024
  if (multipartEnabled && file.size > fallbackThreshold) {
    try {
      await multipartUpload(options, hashes)
      return
    } catch (err: any) {
      if (signal?.aborted) throw err
      console.warn('Multipart upload failed, falling back to Stream upload:', err.message)
    }
  }

  if (signal?.aborted) throw new Error('Upload canceled')

  // 4. Stream Upload (/api/fs/put)
  try {
    await streamUpload(options, hashes)
    return
  } catch (err: any) {
    if (signal?.aborted) throw err
    console.warn('Stream upload failed, falling back to Form upload:', err.message)
  }

  if (signal?.aborted) throw new Error('Upload canceled')

  // 5. Form Upload (/api/fs/form)
  await formUpload(options, hashes)
}
