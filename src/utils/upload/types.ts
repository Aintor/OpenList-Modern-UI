import { Resp } from '~/types'

export type UploadStatus =
  | 'pending'
  | 'hashing'
  | 'uploading'
  | 'backending'
  | 'paused'
  | 'success'
  | 'error'
  | 'canceled'

export type UploadEngineType = 'direct' | 'multipart' | 'stream' | 'form'

export interface HashResult {
  md5: string
  sha1: string
  sha256: string
}

export interface UploadProgressUpdate {
  progress?: number
  loaded?: number
  speed?: number
  status?: UploadStatus
  engine?: UploadEngineType
  error?: string
}

export type UploadProgressCallback = (update: UploadProgressUpdate) => void

export interface UploadOptions {
  targetPath: string
  file: File
  password?: string
  overwrite?: boolean
  asTask?: boolean
  rapid?: boolean
  directUploadTools?: string[]
  multipartEnabled?: boolean
  multipartChunkSizeMB?: number
  chunkThreads?: number
  enableCdnFallback?: boolean
  directFallbackMinSizeMB?: number
  directFallbackMinSpeedKB?: number
  directFallbackDurationSec?: number
  signal?: AbortSignal
  onProgress?: UploadProgressCallback
}

export type MultipartState =
  | 'receiving'
  | 'completed'
  | 'failed_retriable'
  | 'failed_permanent'
  | 'aborted'

export interface MultipartSnapshot {
  upload_id: string
  state: MultipartState
  attempt: number
  path: string
  size: number
  chunk_size: number
  total_chunks: number
  received: [number, number][]
  received_bytes: number
  frontier: number
  storage_progress: number
  error?: string
}

export type MultipartSnapResp = Resp<MultipartSnapshot>
export type MultipartInitResp = Resp<MultipartSnapshot & { resumed: boolean }>

export interface HttpDirectUploadInfo {
  upload_url: string
  method?: string
  chunk_size?: number
  headers?: Record<string, string>
}
