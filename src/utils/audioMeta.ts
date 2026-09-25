import { useState, useEffect } from 'react'
import * as mm from 'music-metadata'
import { Obj, ObjType } from '~/types'
import { getDownloadUrl } from '~/utils/link'
import { useSettingsStore } from '~/store/useSettingsStore'
import { MemoryLRUCache } from '~/utils/lru'

export interface AudioMetadata {
  title?: string
  artist?: string
  album?: string
  coverUrl?: string | null
}

const DEFAULT_AUDIO_EXTS = new Set([
  'mp3',
  'flac',
  'wav',
  'aac',
  'ogg',
  'm4a',
  'opus',
  'ape',
  'wma',
  'alac',
])

const MIME_MAP: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  flac: 'audio/flac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  wma: 'audio/x-ms-wma',
  aac: 'audio/aac',
  ape: 'audio/ape',
  alac: 'audio/alac',
}

export const getAudioExtensions = (): Set<string> => {
  const raw = useSettingsStore.getState().getSetting('audio_types', '')
  if (!raw) return DEFAULT_AUDIO_EXTS
  const list = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return list.length > 0 ? new Set(list) : DEFAULT_AUDIO_EXTS
}

export const isAudioObject = (obj: Obj): boolean => {
  if (obj.is_dir) return false
  if (obj.type === ObjType.AUDIO) return true
  const ext = obj.name.toLowerCase().split('.').pop() || ''
  return getAudioExtensions().has(ext)
}

export const getAudioMetadataCacheKey = (obj: Obj, currentPath: string = '/'): string => {
  const cleanPath = currentPath.replace(/\/+$/, '') || '/'
  return `${cleanPath}/${obj.name}:${obj.modified || ''}:${obj.size || 0}:${obj.sign || ''}`
}

export const getAudioCoverCacheKey = getAudioMetadataCacheKey

async function readResponseSlice(resp: Response, maxBytes: number): Promise<Uint8Array | null> {
  if (!resp.body) {
    const buf = await resp.arrayBuffer()
    return new Uint8Array(buf).subarray(0, maxBytes)
  }

  if (resp.status === 206) {
    const buf = await resp.arrayBuffer()
    return new Uint8Array(buf)
  }

  const reader = resp.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read()
      if (done || !value) break
      const take = Math.min(value.length, maxBytes - total)
      chunks.push(value.subarray(0, take))
      total += take
      if (total >= maxBytes) break
    }
  } finally {
    reader.cancel().catch(() => {})
  }

  if (total === 0) return null
  const res = new Uint8Array(total)
  let off = 0
  for (const c of chunks) {
    res.set(c, off)
    off += c.length
  }
  return res
}

// Bounded in-memory cache: auto-revokes Blob URLs when evicted (max 100 entries)
const memoryMetadataCache = new MemoryLRUCache<string, AudioMetadata>(100, (meta) => {
  if (meta?.coverUrl && meta.coverUrl.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(meta.coverUrl)
    } catch {}
  }
})

const inflightMetadataProbes = new Map<string, Promise<AudioMetadata>>()

function extractMetadata(parsed: mm.IAudioMetadata, defaultCover: string | null = null): AudioMetadata {
  const title = parsed.common.title?.trim() || undefined
  const artist =
    parsed.common.artist?.trim() ||
    (parsed.common.artists && parsed.common.artists.length > 0
      ? parsed.common.artists.map((a) => a.trim()).filter(Boolean).join(', ')
      : undefined)
  const album = parsed.common.album?.trim() || undefined

  let coverUrl = defaultCover
  const cover = mm.selectCover(parsed.common.picture)
  if (cover && cover.data && cover.data.length > 0) {
    const blob = new Blob([cover.data as unknown as BlobPart], {
      type: cover.format || 'image/jpeg',
    })
    coverUrl = URL.createObjectURL(blob)
  }

  return { title, artist, album, coverUrl }
}

/**
 * Extract audio metadata (title, artist, album, cover) using lightweight HTTP Range slices with in-memory LRU cache.
 */
export async function getAudioMetadata(
  obj: Obj,
  currentPath: string = '/'
): Promise<AudioMetadata> {
  if (!isAudioObject(obj)) return {}

  const cacheKey = getAudioMetadataCacheKey(obj, currentPath)

  // 1. Check RAM LRU cache (0ms instant hit)
  if (memoryMetadataCache.has(cacheKey)) {
    return memoryMetadataCache.get(cacheKey)!
  }

  // 2. De-duplicate concurrent inflight requests
  if (inflightMetadataProbes.has(cacheKey)) {
    return inflightMetadataProbes.get(cacheKey)!
  }

  const probePromise = (async (): Promise<AudioMetadata> => {
    const defaultCover = obj.thumb || null
    try {
      const downloadUrl = getDownloadUrl(obj, currentPath)
      if (!downloadUrl) {
        const emptyMeta = { coverUrl: defaultCover }
        memoryMetadataCache.set(cacheKey, emptyMeta)
        return emptyMeta
      }

      const ext = obj.name.toLowerCase().split('.').pop() || ''
      const mimeType = MIME_MAP[ext] || 'audio/mpeg'

      // Step 1: Probe Head Range (0-524288 bytes)
      try {
        const rangeResp = await fetch(downloadUrl, {
          headers: { Range: 'bytes=0-524288' },
        })

        if (rangeResp.ok || rangeResp.status === 206) {
          const uint8 = await readResponseSlice(rangeResp, 524288)
          if (uint8) {
            const parsed = await mm.parseBuffer(uint8, {
              mimeType,
              path: obj.name,
              size: obj.size,
            })

            const meta = extractMetadata(parsed, defaultCover)
            if (meta.title || meta.artist || meta.coverUrl) {
              memoryMetadataCache.set(cacheKey, meta)
              return meta
            }
          }
        }
      } catch (rangeErr) {
        console.debug('[AudioMetadata] Head range probe error:', rangeErr)
      }

      // Step 2: For M4A/AAC/MP4 where metadata (moov) is at the tail of the file:
      // Send Range request to the TAIL (last 512KB)
      if (obj.size && obj.size > 524288 && (ext === 'm4a' || ext === 'aac' || ext === 'mp4' || ext === 'alac' || ext === 'wav')) {
        try {
          const tailStart = Math.max(0, obj.size - 524288)
          const tailResp = await fetch(downloadUrl, {
            headers: { Range: `bytes=${tailStart}-${obj.size - 1}` },
          })
          if (tailResp.status === 206) {
            const tailUint8 = await readResponseSlice(tailResp, 524288)
            if (tailUint8) {
              const parsed = await mm.parseBuffer(tailUint8, {
                mimeType,
                path: obj.name,
                size: obj.size,
              })

              const meta = extractMetadata(parsed, defaultCover)
              memoryMetadataCache.set(cacheKey, meta)
              return meta
            }
          } else {
            tailResp.body?.getReader().cancel().catch(() => {})
          }
        } catch (tailErr) {
          console.debug('[AudioMetadata] Tail range probe error:', tailErr)
        }
      }

      const fallbackMeta: AudioMetadata = { coverUrl: defaultCover }
      memoryMetadataCache.set(cacheKey, fallbackMeta)
      return fallbackMeta
    } catch {
      const fallbackMeta: AudioMetadata = { coverUrl: defaultCover }
      memoryMetadataCache.set(cacheKey, fallbackMeta)
      return fallbackMeta
    } finally {
      inflightMetadataProbes.delete(cacheKey)
    }
  })()

  inflightMetadataProbes.set(cacheKey, probePromise)
  return probePromise
}

/**
 * Extract audio cover using lightweight HTTP Range slices with in-memory LRU cache.
 */
export async function getAudioCover(
  obj: Obj,
  currentPath: string = '/'
): Promise<string | null> {
  const meta = await getAudioMetadata(obj, currentPath)
  return meta.coverUrl || null
}

/**
 * React hook for consuming rich audio metadata (title, artist, album, coverUrl) with in-memory LRU cache.
 */
export function useAudioMetadata(obj: Obj | null, currentPath: string = '/'): AudioMetadata {
  const isAudio = obj ? isAudioObject(obj) : false
  const [meta, setMeta] = useState<AudioMetadata>(() => {
    if (!obj || !isAudio) return {}
    const cacheKey = getAudioMetadataCacheKey(obj, currentPath)
    return memoryMetadataCache.get(cacheKey) || { coverUrl: obj.thumb || null }
  })

  useEffect(() => {
    if (!obj || !isAudio) {
      setMeta({})
      return
    }

    const cacheKey = getAudioMetadataCacheKey(obj, currentPath)
    const cached = memoryMetadataCache.get(cacheKey)
    if (cached) {
      setMeta(cached)
      return
    }

    let active = true

    getAudioMetadata(obj, currentPath).then((res) => {
      if (active && res) {
        setMeta(res)
      }
    })

    return () => {
      active = false
    }
  }, [obj?.name, obj?.modified, obj?.size, obj?.sign, currentPath, isAudio])

  return meta
}

/**
 * React hook for consuming audio covers with in-memory LRU cache.
 */
export function useAudioCover(obj: Obj | null, currentPath: string = '/'): string | null {
  const meta = useAudioMetadata(obj, currentPath)
  return meta.coverUrl || null
}
