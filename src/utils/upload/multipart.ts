import { r } from '~/utils/request'
import {
  UploadOptions,
  HashResult,
  MultipartInitResp,
  MultipartSnapResp,
} from './types'

const MAX_FLOW_RETRIES = 400

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const mpRequest = async <T>(req: Promise<any>, signal?: AbortSignal): Promise<T | undefined> => {
  if (signal?.aborted) throw new Error('Upload canceled')
  try {
    const resp = await req
    if (resp && typeof resp.code === 'number' && 'data' in resp) {
      return resp as T
    }
    if (resp?.code === -1) {
      throw new Error(resp.message || 'Upload canceled')
    }
    return undefined
  } catch (err: any) {
    if (signal?.aborted || err?.message === 'Upload canceled' || err?.code === 'ERR_CANCELED') {
      throw new Error('Upload canceled')
    }
    return undefined
  }
}

export const multipartUpload = async (
  options: UploadOptions,
  hashes?: HashResult
): Promise<void> => {
  const {
    targetPath,
    file,
    password = '',
    overwrite = true,
    multipartChunkSizeMB = 10,
    signal,
    onProgress,
  } = options

  const chunkSizeSuggested = Math.max(1, multipartChunkSizeMB) * 1024 * 1024

  const initHeaders: Record<string, any> = {
    'File-Path': encodeURIComponent(targetPath),
    'X-File-Size': file.size,
    'X-Chunk-Size': chunkSizeSuggested,
    'Content-Type': file.type || 'application/octet-stream',
    'Last-Modified': file.lastModified,
    Password: password,
    Overwrite: overwrite.toString(),
  }

  if (hashes) {
    if (hashes.md5) initHeaders['X-File-Md5'] = hashes.md5
    if (hashes.sha1) initHeaders['X-File-Sha1'] = hashes.sha1
    if (hashes.sha256) initHeaders['X-File-Sha256'] = hashes.sha256
  }

  onProgress?.({ status: 'uploading', engine: 'multipart', progress: 0, loaded: 0, speed: 0 })

  // 1. Initialize multipart session
  let initResp: MultipartInitResp | undefined
  for (let i = 0; ; i++) {
    if (signal?.aborted) throw new Error('Upload canceled')
    initResp = await mpRequest<MultipartInitResp>(
      r.post('/fs/multipart/init', undefined, { headers: initHeaders, signal }),
      signal
    )
    if (initResp) break
    if (i >= 3) throw new Error('Multipart init failed: network error')
    await sleep(1000 * (i + 1))
  }

  if (!initResp || initResp.code !== 200) {
    throw new Error(initResp?.message || 'Multipart init rejected')
  }

  const session = initResp.data
  const uploadId = session.upload_id
  const chunkSize = session.chunk_size || chunkSizeSuggested
  const totalChunks = session.total_chunks
  const chunkLen = (idx: number) =>
    idx === totalChunks - 1 ? file.size - idx * chunkSize : chunkSize

  // If already completed server-side (rapid upload)
  if (session.state === 'completed') {
    onProgress?.({ progress: 100, loaded: file.size, speed: 0, status: 'success' })
    return
  }

  // Calculate missing chunks
  const have = new Set<number>()
  for (const [lo, hi] of session.received ?? []) {
    for (let i = lo; i <= hi; i++) have.add(i)
  }
  const missing: number[] = []
  for (let i = 0; i < totalChunks; i++) {
    if (!have.has(i)) missing.push(i)
  }

  let ackedBytes = session.received_bytes ?? 0
  const inflightLoaded: Record<number, number> = {}
  let peakDone = ackedBytes
  let lastTime = Date.now()
  let lastBytes = ackedBytes

  const report = () => {
    let inflight = 0
    for (const v of Object.values(inflightLoaded)) inflight += v
    peakDone = Math.max(peakDone, Math.min(ackedBytes + inflight, file.size))
    const percent = file.size > 0 ? Math.min(99, Math.round((peakDone / file.size) * 100)) : 0
    const now = Date.now()
    let currentSpeed = 0
    if (now - lastTime >= 500) {
      currentSpeed = Math.max(0, ((peakDone - lastBytes) / (now - lastTime)) * 1000)
      lastTime = now
      lastBytes = peakDone
    }

    onProgress?.({
      progress: percent,
      loaded: peakDone,
      speed: currentSpeed > 0 ? currentSpeed : undefined,
      status: 'uploading',
    })
  }

  let completedEarly = false
  let fatalError: Error | undefined

  const sendChunk = async (idx: number) => {
    const blob = file.slice(idx * chunkSize, idx * chunkSize + chunkLen(idx))
    let flowRetries = 0

    for (;;) {
      if (completedEarly || fatalError || signal?.aborted) return

      const resp = await mpRequest<MultipartSnapResp>(
        r.put('/fs/multipart/chunk', blob, {
          headers: {
            'X-Upload-Id': uploadId,
            'X-Chunk-Index': idx,
            'Content-Type': 'application/octet-stream',
          },
          signal,
          onUploadProgress: (e: any) => {
            inflightLoaded[idx] = e.loaded ?? 0
            report()
          },
        }),
        signal
      )

      delete inflightLoaded[idx]

      if (resp && resp.code === 200) {
        ackedBytes += chunkLen(idx)
        if (resp.data?.state === 'completed') {
          completedEarly = true
        }
        report()
        return
      }

      if (resp && resp.code !== 429 && resp.code !== 409) {
        throw new Error(resp.message || `Chunk ${idx} rejected`)
      }

      if (!resp) {
        // Probe status to check if completed early
        const st = await mpRequest<MultipartSnapResp>(
          r.get(`/fs/multipart/status?upload_id=${uploadId}`, { signal }),
          signal
        )
        if (st?.code === 200 && st.data.state === 'completed') {
          completedEarly = true
          return
        }
        if (st?.code === 200 && st.data.state.startsWith('failed')) {
          throw new Error(st.data.error || `Upload failed (${st.data.state})`)
        }
      }

      flowRetries++
      if (flowRetries > MAX_FLOW_RETRIES) {
        throw new Error(`Chunk ${idx} stalled: storage uplink timeout`)
      }
      await sleep(resp ? 600 : Math.min(1000 * flowRetries, 4000))
    }
  }

  // Refill chunk 0 if retriable
  let startFrom = 0
  if (session.state === 'failed_retriable' && missing.length > 0) {
    await sendChunk(missing[0])
    startFrom = 1
  }

  let nextCursor = startFrom
  const worker = async () => {
    for (;;) {
      if (completedEarly || fatalError || signal?.aborted) return
      const i = nextCursor++
      if (i >= missing.length) return
      try {
        await sendChunk(missing[i])
      } catch (err: any) {
        fatalError = err instanceof Error ? err : new Error(String(err))
        return
      }
    }
  }

  const inflightCount = options.chunkThreads || 5

  await Promise.all(
    Array.from({ length: Math.min(inflightCount, missing.length) || 1 }, worker)
  )

  if (fatalError) throw fatalError
  if (signal?.aborted) throw new Error('Upload canceled')

  // 3. Complete and backend polling
  onProgress?.({ status: 'backending', speed: 0 })

  let settled = false
  const completePromise = mpRequest<MultipartSnapResp>(
    r.post('/fs/multipart/complete', undefined, {
      headers: { 'X-Upload-Id': uploadId },
      signal,
    }),
    signal
  )
    .catch(() => undefined)
    .finally(() => {
      settled = true
    })

  while (!settled && !signal?.aborted) {
    await sleep(1500)
    if (settled) break
    const st = await mpRequest<MultipartSnapResp>(
      r.get(`/fs/multipart/status?upload_id=${uploadId}`, { signal }),
      signal
    )
    if (st?.code === 200 && st.data.state === 'receiving') {
      onProgress?.({
        progress: Math.min(99, Math.round(st.data.storage_progress || 99)),
        status: 'backending',
        speed: 0,
      })
    }
  }

  const fin = await completePromise
  if (fin) {
    if (fin.code !== 200) throw new Error(fin.message || 'Complete failed')
    onProgress?.({ progress: 100, loaded: file.size, speed: 0, status: 'success' })
    return
  }

  // Poll till end
  for (let pollCount = 0; pollCount < 100; pollCount++) {
    if (signal?.aborted) throw new Error('Upload canceled')
    await sleep(2000)
    const st = await mpRequest<MultipartSnapResp>(
      r.get(`/fs/multipart/status?upload_id=${uploadId}`, { signal }),
      signal
    )
    if (!st) continue
    if (st.code === 404 || (st.code === 200 && st.data.state === 'completed')) {
      onProgress?.({ progress: 100, loaded: file.size, speed: 0, status: 'success' })
      return
    }
    if (st.code !== 200) throw new Error(st.message)
    if (st.data.state.startsWith('failed')) {
      throw new Error(st.data.error || `Upload failed (${st.data.state})`)
    }
    if (st.data.state === 'receiving') {
      onProgress?.({
        progress: Math.min(99, Math.round(st.data.storage_progress || 99)),
        status: 'backending',
        speed: 0,
      })
    }
  }
}
