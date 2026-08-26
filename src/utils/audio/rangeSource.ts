/**
 * Universal Range-based Chunked Source & Demuxer Helper
 * Translates byte-range demands into on-demand HTTP Range requests with LRU block caching and magic-byte auto-detection.
 */

export interface RangeChunk {
  start: number
  end: number
  data: Uint8Array
}

export interface M4AHeaderInfo {
  isFastStart: boolean
  ftypBox: Uint8Array
  moovBox?: Uint8Array
  audioStartOffset: number
}

/**
 * Detects audio container format purely from raw binary magic bytes without relying on filename or extension
 */
export function detectFormatFromMagicBytes(bytes: Uint8Array): string {
  if (!bytes || bytes.length < 4) return 'flac'

  // 1. ISOBMFF Container (M4A / MP4 / ALAC / AAC): bytes 4-7 are 'ftyp' or 'moov'
  if (bytes.length >= 8) {
    const b4_7 = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7])
    if (b4_7 === 'ftyp' || b4_7 === 'moov' || b4_7 === 'mdat') {
      return 'm4a'
    }
  }

  // 2. FLAC: 'fLaC' (0x66 0x4C 0x61 0x43)
  if (bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) {
    return 'flac'
  }

  // 3. OGG / Opus / Vorbis: 'OggS' (0x4F 0x67 0x67 0x53)
  if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return 'oga'
  }

  // 4. MP3: ID3v2 ('ID3') or sync word 0xFFE0..0xFFFF
  if (
    (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
    (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  ) {
    return 'mp3'
  }

  // 5. WAV: 'RIFF' .... 'WAVE'
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x41 &&
    bytes[10] === 0x56 &&
    bytes[11] === 0x45
  ) {
    return 'wav'
  }

  // 6. AIFF: 'FORM' .... 'AIFF'
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x46 &&
    bytes[1] === 0x4f &&
    bytes[2] === 0x52 &&
    bytes[3] === 0x4d
  ) {
    return 'aiff'
  }

  // 7. CAF (Core Audio Format): 'caff'
  if (bytes[0] === 0x63 && bytes[1] === 0x61 && bytes[2] === 0x66 && bytes[3] === 0x66) {
    return 'caf'
  }

  // 8. QOA: 'qoaf'
  if (bytes[0] === 0x71 && bytes[1] === 0x6f && bytes[2] === 0x61 && bytes[3] === 0x66) {
    return 'qoa'
  }

  // 9. WebM / Matroska: 0x1A 0x45 0xDF 0xA3
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0x75) {
    return 'webm'
  }

  // 10. AMR: '#!AMR'
  if (bytes[0] === 0x23 && bytes[1] === 0x21 && bytes[2] === 0x41 && bytes[3] === 0x4d) {
    return 'amr'
  }

  // 11. WMA / ASF: 0x30 0x26 0xB2 0x75
  if (bytes[0] === 0x30 && bytes[1] === 0x26 && bytes[2] === 0xb2 && bytes[3] === 0x75) {
    return 'wma'
  }

  return 'flac'
}

/**
 * Universal Range Source Manager
 */
export class RangeSource {
  private supportsRange: boolean | null = null
  private totalFileSize: number = 0
  private blockCache = new Map<number, Uint8Array>()
  private readonly blockSize = 262144 // 256 KB blocks

  constructor(
    public readonly url: string,
    initialSize: number = 0
  ) {
    this.totalFileSize = initialSize
  }

  public getFileSize(): number {
    return this.totalFileSize
  }

  public isRangeSupported(): boolean | null {
    return this.supportsRange
  }

  /**
   * Fetches a specific byte range [start, end]
   */
  public async readRange(start: number, end: number, signal?: AbortSignal): Promise<Uint8Array> {
    console.log(
      `[AudioRange] 📥 Fetching Range: bytes=${start}-${end} (${((end - start + 1) / 1024).toFixed(1)} KB) | URL: ${this.url.split('?')[0].split('/').pop()}`
    )

    let resp: Response
    try {
      resp = await fetch(this.url, {
        headers: { Range: `bytes=${start}-${end}` },
        signal,
      })
    } catch (err: any) {
      console.warn(`[AudioRange] ⚠️ Range request failed (network/CORS):`, err)
      this.supportsRange = false
      throw err
    }

    if (resp.status === 206) {
      this.supportsRange = true
      const contentRange = resp.headers.get('Content-Range')
      if (contentRange) {
        const match = contentRange.match(/\/(\d+)$/)
        if (match) {
          this.totalFileSize = parseInt(match[1], 10)
        }
      }
      console.log(`[AudioRange] ✅ 206 Partial Content received (${((end - start + 1) / 1024).toFixed(1)} KB)`)
      const buf = await resp.arrayBuffer()
      return new Uint8Array(buf)
    }

    if (resp.status === 200) {
      console.log(`[AudioRange] ℹ️ Server returned 200 OK (Range ignored). Slicing only ${((end - start + 1) / 1024).toFixed(1)} KB.`)
      this.supportsRange = false
      const requestedLen = end - start + 1
      const reader = resp.body?.getReader()
      if (!reader) {
        const buf = await resp.arrayBuffer()
        return new Uint8Array(buf).subarray(0, requestedLen)
      }

      const chunks: Uint8Array[] = []
      let readCount = 0

      try {
        while (readCount < requestedLen) {
          const { done, value } = await reader.read()
          if (done || !value) break
          const take = Math.min(value.length, requestedLen - readCount)
          chunks.push(value.subarray(0, take))
          readCount += take
          if (readCount >= requestedLen) break
        }
      } finally {
        reader.cancel().catch(() => {})
      }

      const result = new Uint8Array(readCount)
      let offset = 0
      for (const c of chunks) {
        result.set(c, offset)
        offset += c.length
      }
      return result
    }

    throw new Error(`HTTP Range request failed: ${resp.status} ${resp.statusText}`)
  }

  /**
   * Reads block with LRU memory caching
   */
  public async readBlock(blockIndex: number, signal?: AbortSignal): Promise<Uint8Array> {
    if (this.blockCache.has(blockIndex)) {
      return this.blockCache.get(blockIndex)!
    }

    const start = blockIndex * this.blockSize
    const end = this.totalFileSize > 0 ? Math.min(start + this.blockSize - 1, this.totalFileSize - 1) : start + this.blockSize - 1

    const data = await this.readRange(start, end, signal)
    if (this.blockCache.size > 20) {
      const firstKey = this.blockCache.keys().next().value
      if (firstKey !== undefined) this.blockCache.delete(firstKey)
    }
    this.blockCache.set(blockIndex, data)
    return data
  }

  /**
   * Fast probe to extract format and detect if M4A index is at tail
   */
  public async probeHeader(signal?: AbortSignal): Promise<{ format: string; m4aInfo?: M4AHeaderInfo }> {
    // Read head block (0 - 64KB)
    let head: Uint8Array
    try {
      head = await this.readRange(0, 65535, signal)
    } catch {
      return { format: 'flac' }
    }

    const format = detectFormatFromMagicBytes(head)
    console.log(`[AudioRange] 🔍 Magic bytes auto-detected container: "${format}"`)

    if (format !== 'm4a') {
      return { format }
    }

    // Inspect M4A boxes to check if moov is at head or tail
    let ftypBox: Uint8Array = head.subarray(0, 32)
    let moovFound = false
    let mdatOffset = 0
    let off = 0

    while (off + 8 <= head.length) {
      const size = ((head[off] << 24) | (head[off + 1] << 16) | (head[off + 2] << 8) | head[off + 3]) >>> 0
      const type = String.fromCharCode(head[off + 4], head[off + 5], head[off + 6], head[off + 7])

      if (type === 'ftyp') {
        ftypBox = head.subarray(off, off + size)
      } else if (type === 'moov') {
        moovFound = true
        break
      } else if (type === 'mdat') {
        mdatOffset = off
      }

      if (size < 8) break
      off += size
    }

    if (moovFound) {
      console.log(`[AudioRange] ⚡ M4A is fast-start (moov found in header)`)
      return {
        format: 'm4a',
        m4aInfo: {
          isFastStart: true,
          ftypBox,
          audioStartOffset: mdatOffset > 0 ? mdatOffset + 8 : 0,
        },
      }
    }

    // Non-faststart M4A: moov is located at the TAIL of the file!
    // Fetch last 256KB via Range to locate moov
    let moovBox: Uint8Array | undefined
    const probeWindow = 262144 // 256KB
    if (this.totalFileSize > 65536) {
      try {
        const tailStart = Math.max(0, this.totalFileSize - probeWindow)
        const tail = await this.readRange(tailStart, this.totalFileSize - 1, signal)

        // Find 'moov' atom in tail buffer
        for (let i = 0; i < tail.length - 8; i++) {
          if (
            tail[i + 4] === 0x6d && // 'm'
            tail[i + 5] === 0x6f && // 'o'
            tail[i + 6] === 0x6f && // 'o'
            tail[i + 7] === 0x76    // 'v'
          ) {
            const size = ((tail[i] << 24) | (tail[i + 1] << 16) | (tail[i + 2] << 8) | tail[i + 3]) >>> 0
            moovBox = tail.subarray(i, Math.min(tail.length, i + size))
            console.log(`[AudioRange] 🎯 M4A non-faststart: Successfully extracted tail moov box (${(moovBox.length / 1024).toFixed(1)} KB)`)
            break
          }
        }
      } catch (tailErr) {
        console.warn(`[AudioRange] ⚠️ Tail moov probe failed:`, tailErr)
      }
    }

    return {
      format: 'm4a',
      m4aInfo: {
        isFastStart: false,
        ftypBox,
        moovBox,
        audioStartOffset: mdatOffset > 0 ? mdatOffset + 8 : 0,
      },
    }
  }

  public clear(): void {
    this.blockCache.clear()
  }
}
