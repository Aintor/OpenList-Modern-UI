import { useState, useEffect } from 'react'
import * as mm from 'music-metadata'
import { Obj, ObjType } from '~/types'
import { getDownloadUrl } from '~/utils/link'
import { useSettingsStore } from '~/store/useSettingsStore'
import { MemoryLRUCache } from '~/utils/lru'

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

export const getAudioCoverCacheKey = (obj: Obj, currentPath: string = '/'): string => {
  const cleanPath = currentPath.replace(/\/+$/, '') || '/'
  return `${cleanPath}/${obj.name}:${obj.modified || ''}:${obj.size || 0}:${obj.sign || ''}`
}

// Bounded in-memory cache: auto-revokes Blob URLs when evicted (max 100 covers)
const memoryCoverCache = new MemoryLRUCache<string, string | null>(100, (url) => {
  if (url && url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url)
    } catch {}
  }
})

const inflightProbes = new Map<string, Promise<string | null>>()

/**
 * Extract audio cover using lightweight HTTP Range slices with in-memory LRU cache.
 */
export async function getAudioCover(
  obj: Obj,
  currentPath: string = '/'
): Promise<string | null> {
  if (!isAudioObject(obj)) return null
  if (obj.thumb) return obj.thumb

  const cacheKey = getAudioCoverCacheKey(obj, currentPath)

  // 1. Check RAM LRU cache (0ms instant hit)
  if (memoryCoverCache.has(cacheKey)) {
    return memoryCoverCache.get(cacheKey) || null
  }

  // 2. De-duplicate concurrent inflight requests
  if (inflightProbes.has(cacheKey)) {
    return inflightProbes.get(cacheKey)!
  }

  const probePromise = (async () => {
    try {
      const downloadUrl = getDownloadUrl(obj, currentPath)
      if (!downloadUrl) {
        memoryCoverCache.set(cacheKey, null)
        return null
      }

      const ext = obj.name.toLowerCase().split('.').pop() || ''
      const mimeType = MIME_MAP[ext] || 'audio/mpeg'

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

      // Step 1: Probe Head Range (0-524288 bytes)
      try {
        const rangeResp = await fetch(downloadUrl, {
          headers: { Range: 'bytes=0-524288' },
        })

        if (rangeResp.ok || rangeResp.status === 206) {
          const uint8 = await readResponseSlice(rangeResp, 524288)
          if (uint8) {
            const metadata = await mm.parseBuffer(uint8, {
              mimeType,
              path: obj.name,
              size: obj.size,
            })

            const cover = mm.selectCover(metadata.common.picture)
            if (cover && cover.data && cover.data.length > 0) {
              const blob = new Blob([cover.data as unknown as BlobPart], {
                type: cover.format || 'image/jpeg',
              })
              const blobUrl = URL.createObjectURL(blob)
              memoryCoverCache.set(cacheKey, blobUrl)
              return blobUrl
            }
          }
        }
      } catch (rangeErr) {
        console.debug('[AudioCover] Head range probe error:', rangeErr)
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
              const metadata = await mm.parseBuffer(tailUint8, {
                mimeType,
                path: obj.name,
                size: obj.size,
              })

              const cover = mm.selectCover(metadata.common.picture)
              if (cover && cover.data && cover.data.length > 0) {
                const blob = new Blob([cover.data as unknown as BlobPart], {
                  type: cover.format || 'image/jpeg',
                })
                const blobUrl = URL.createObjectURL(blob)
                memoryCoverCache.set(cacheKey, blobUrl)
                return blobUrl
              }
            }
          } else {
            tailResp.body?.getReader().cancel().catch(() => {})
          }
        } catch (tailErr) {
          console.debug('[AudioCover] Tail range probe error:', tailErr)
        }
      }

      memoryCoverCache.set(cacheKey, null)
      return null
    } catch {
      memoryCoverCache.set(cacheKey, null)
      return null
    } finally {
      inflightProbes.delete(cacheKey)
    }
  })()

  inflightProbes.set(cacheKey, probePromise)
  return probePromise
}

/**
 * React hook for consuming audio covers with in-memory LRU cache.
 */
export function useAudioCover(obj: Obj | null, currentPath: string = '/'): string | null {
  const isAudio = obj ? isAudioObject(obj) : false
  const [coverUrl, setCoverUrl] = useState<string | null>(() => {
    if (!obj || !isAudio) return null
    if (obj.thumb) return obj.thumb
    const cacheKey = getAudioCoverCacheKey(obj, currentPath)
    return memoryCoverCache.get(cacheKey) || null
  })

  useEffect(() => {
    if (!obj || !isAudio) {
      setCoverUrl(null)
      return
    }

    if (obj.thumb) {
      setCoverUrl(obj.thumb)
      return
    }

    const cacheKey = getAudioCoverCacheKey(obj, currentPath)
    if (memoryCoverCache.has(cacheKey)) {
      setCoverUrl(memoryCoverCache.get(cacheKey) || null)
      return
    }

    let active = true

    getAudioCover(obj, currentPath).then((url) => {
      if (active && url) {
        setCoverUrl(url)
      }
    })

    return () => {
      active = false
    }
  }, [obj?.name, obj?.modified, obj?.size, obj?.sign, currentPath, isAudio])

  return coverUrl
}
