import { HashResult } from './types'
import type { WorkerMessage } from './hashWorker'

export const calculateHash = async (
  file: File,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal
): Promise<HashResult> => {
  return new Promise<HashResult>((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new Error('Calculation canceled'))
    }

    let worker: Worker | null = null
    try {
      worker = new Worker(new URL('./hashWorker.ts', import.meta.url), {
        type: 'module',
      })
    } catch (err: any) {
      return reject(err)
    }

    const activeWorker = worker

    const cleanup = () => {
      if (activeWorker) {
        activeWorker.terminate()
      }
      if (signal) {
        signal.removeEventListener('abort', onAbort)
      }
    }

    const onAbort = () => {
      cleanup()
      reject(new Error('Calculation canceled'))
    }

    if (signal) {
      signal.addEventListener('abort', onAbort)
    }

    activeWorker.postMessage({ file })

    activeWorker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const data = e.data
      switch (data.type) {
        case 'progress':
          onProgress?.(data.progress)
          break
        case 'result':
          cleanup()
          resolve(data.hash)
          break
        case 'error':
          cleanup()
          reject(new Error(data.error))
          break
      }
    }

    activeWorker.onerror = (e) => {
      cleanup()
      reject(new Error(e.message || 'Worker hash error'))
    }
  })
}
