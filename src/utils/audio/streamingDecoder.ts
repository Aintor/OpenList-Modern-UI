import decode from 'audio-decode'
import * as mm from 'music-metadata'
import { AudioPCMChunk } from './types'
import { RangeSource, detectFormatFromMagicBytes } from './rangeSource'

export interface StreamingDecoderOptions {
  maxBufferAhead?: number // Target maximum buffer ahead in seconds (default: 30)
  minBufferAhead?: number // Minimum buffer ahead before resuming download (default: 15)
}

export interface DecodedPCMBlock {
  startSample: number
  channelData: Float32Array[]
}

export type StreamingDecoderFn = {
  (chunk?: Uint8Array): Promise<AudioPCMChunk | null | undefined>
  free?: () => void
}

export type CodecInitializer = () => Promise<StreamingDecoderFn>

export type AudioDecodeModule = typeof decode & Record<string, CodecInitializer | unknown>

/**
 * Streaming Decoder Session with Universal Range-Broker & Sliding Window Backpressure Control
 * Translates decoder requirements into on-demand HTTP Range requests.
 * Automatically handles magic-byte detection, tail moov extraction, and flow control.
 */
export class StreamingDecoderSession {
  private abortController: AbortController | null = null
  private recentBlocks: DecodedPCMBlock[] = []
  private sampleRate: number = 44100
  private totalSamplesDecoded: number = 0
  private knownDuration: number = 0
  private isDone: boolean = false
  private currentPlaybackTime: number = 0

  private readonly maxBufferAhead: number
  private readonly minBufferAhead: number
  private drainResolvers: Set<() => void> = new Set()

  public onChunk?: (chunk: AudioPCMChunk) => void
  public onDuration?: (duration: number) => void
  public onComplete?: () => void
  public onError?: (error: Error) => void

  constructor(
    private rawUrl: string,
    private filename: string = '',
    private estimatedSize: number = 0,
    options?: StreamingDecoderOptions
  ) {
    this.maxBufferAhead = options?.maxBufferAhead ?? 30
    this.minBufferAhead = options?.minBufferAhead ?? 15
  }

  public getSampleRate(): number {
    return this.sampleRate
  }

  public getTotalSamples(): number {
    return this.totalSamplesDecoded
  }

  public getDecodedDuration(): number {
    return this.sampleRate > 0 ? this.totalSamplesDecoded / this.sampleRate : 0
  }

  public getKnownDuration(): number {
    return this.knownDuration
  }

  public isComplete(): boolean {
    return this.isDone
  }

  /**
   * Updates playback timestamp from the audio rendering thread to drive the sliding window flow control
   */
  public updatePlaybackTime(currentTime: number): void {
    this.currentPlaybackTime = Math.max(0, currentTime)
    const bufferAhead = this.getDecodedDuration() - this.currentPlaybackTime
    if (bufferAhead < this.minBufferAhead && this.drainResolvers.size > 0) {
      this.drainResolvers.forEach((resolve) => resolve())
      this.drainResolvers.clear()
    }
  }

  /**
   * Notifies the decoder session that a seek has occurred, immediately waking up download if needed
   */
  public notifySeek(newTime: number): void {
    this.currentPlaybackTime = Math.max(0, newTime)
    if (this.drainResolvers.size > 0) {
      this.drainResolvers.forEach((resolve) => resolve())
      this.drainResolvers.clear()
    }
  }

  /**
   * Returns a copy of decoded PCM starting from startSample to the end of bounded memory buffer
   */
  public getSliceFromSample(startSample: number): Float32Array[] | null {
    if (this.recentBlocks.length === 0 || this.sampleRate <= 0) return null
    if (startSample >= this.totalSamplesDecoded) return null

    const firstBlock = this.recentBlocks[0]
    if (startSample < firstBlock.startSample) {
      // Requested sample has already been pruned from the sliding memory window
      return null
    }

    const matchingBlocks = this.recentBlocks.filter((b) => {
      const blockEnd = b.startSample + b.channelData[0].length
      return blockEnd > startSample
    })

    if (matchingBlocks.length === 0) return null

    const numChannels = matchingBlocks[0].channelData.length
    let totalLen = 0

    for (let i = 0; i < matchingBlocks.length; i++) {
      const b = matchingBlocks[i]
      const blockLen = b.channelData[0].length
      const offsetInBlock = i === 0 ? Math.max(0, startSample - b.startSample) : 0
      totalLen += blockLen - offsetInBlock
    }

    if (totalLen <= 0) return null

    const result: Float32Array[] = new Array(numChannels)
    for (let ch = 0; ch < numChannels; ch++) {
      result[ch] = new Float32Array(totalLen)
    }

    let writeOffset = 0
    for (let i = 0; i < matchingBlocks.length; i++) {
      const b = matchingBlocks[i]
      const blockLen = b.channelData[0].length
      const offsetInBlock = i === 0 ? Math.max(0, startSample - b.startSample) : 0
      const count = blockLen - offsetInBlock

      for (let ch = 0; ch < numChannels; ch++) {
        const src = b.channelData[ch].subarray(offsetInBlock, offsetInBlock + count)
        result[ch].set(src, writeOffset)
      }
      writeOffset += count
    }

    return result
  }

  /**
   * Backpressure wait loop: pauses reading from network until buffer drains below threshold
   */
  private waitForBufferDrain(signal: AbortSignal): Promise<void> {
    return new Promise<void>((resolve) => {
      if (signal.aborted) {
        resolve()
        return
      }

      let timeoutId: number | null = null

      const cleanup = () => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        this.drainResolvers.delete(onWake)
        signal.removeEventListener('abort', onAbort)
      }

      const onWake = () => {
        cleanup()
        resolve()
      }

      const onAbort = () => {
        cleanup()
        resolve()
      }

      this.drainResolvers.add(onWake)
      signal.addEventListener('abort', onAbort, { once: true })

      // Safety watchdog tick to re-verify buffer ahead every 500ms
      timeoutId = window.setTimeout(() => {
        const bufferAhead = this.getDecodedDuration() - this.currentPlaybackTime
        if (bufferAhead < this.minBufferAhead) {
          onWake()
        } else {
          this.waitForBufferDrain(signal).then(resolve)
        }
      }, 500)
    })
  }

  /**
   * Fast metadata probe to extract track duration without waiting for full download
   */
  private async probeMetadata(signal: AbortSignal): Promise<void> {
    try {
      const probeBytes = 131072 // 128 KB
      const headResp = await fetch(this.rawUrl, {
        headers: { Range: `bytes=0-${probeBytes - 1}` },
        signal,
      })

      if (headResp.ok || headResp.status === 206) {
        let headUint8: Uint8Array
        if (headResp.status === 206) {
          const buf = await headResp.arrayBuffer()
          headUint8 = new Uint8Array(buf)
        } else {
          // Truncate 200 OK stream immediately
          const reader = headResp.body?.getReader()
          if (!reader) {
            const buf = await headResp.arrayBuffer()
            headUint8 = new Uint8Array(buf).subarray(0, probeBytes)
          } else {
            const chunks: Uint8Array[] = []
            let readBytes = 0
            try {
              while (readBytes < probeBytes) {
                const { done, value } = await reader.read()
                if (done || !value) break
                const take = Math.min(value.length, probeBytes - readBytes)
                chunks.push(value.subarray(0, take))
                readBytes += take
                if (readBytes >= probeBytes) break
              }
            } finally {
              reader.cancel().catch(() => {})
            }
            headUint8 = new Uint8Array(readBytes)
            let offset = 0
            for (const c of chunks) {
              headUint8.set(c, offset)
              offset += c.length
            }
          }
        }

        const format = detectFormatFromMagicBytes(headUint8)
        const mimeMap: Record<string, string> = {
          flac: 'audio/flac',
          m4a: 'audio/mp4',
          oga: 'audio/ogg',
          mp3: 'audio/mpeg',
          wav: 'audio/wav',
          aiff: 'audio/aiff',
          webm: 'audio/webm',
        }

        const meta = await mm.parseBuffer(headUint8, {
          mimeType: mimeMap[format] || 'audio/flac',
          path: this.filename,
          size: this.estimatedSize,
        })

        if (meta.format.duration && meta.format.duration > 0) {
          this.knownDuration = meta.format.duration
          this.onDuration?.(this.knownDuration)
        }
      }
    } catch {
      // Non-critical: duration will be computed on the fly as stream progresses
    }
  }

  /**
   * Start streaming and decoding chunks with universal Range demand broker & sliding window flow control
   */
  public async start(): Promise<void> {
    this.abortController = new AbortController()
    const { signal } = this.abortController

    // 1. Kick off background metadata probe (non-blocking)
    this.probeMetadata(signal).catch(() => {})

    try {
      const rangeSource = new RangeSource(this.rawUrl, this.estimatedSize)

      // 2. Auto-detect format by Magic Bytes and probe container header layout
      const { format, m4aInfo } = await rangeSource.probeHeader(signal)
      const formatName = format || 'flac'

      const decodeModule = decode as unknown as AudioDecodeModule
      const codecInit = (decodeModule[formatName] || decodeModule['flac']) as CodecInitializer | undefined
      const dec = typeof codecInit === 'function' ? await codecInit() : null

      if (!dec) {
        // Fallback: whole-file if format decoder is unavailable
        const response = await fetch(this.rawUrl, { signal })
        const arrayBuf = await response.arrayBuffer()
        const result = await decode(arrayBuf)
        this.appendPCM(result.channelData, result.sampleRate)
        this.onChunk?.({
          channelData: result.channelData,
          sampleRate: result.sampleRate,
          samplesDecoded: result.channelData[0]?.length || 0,
        })
        this.isDone = true
        this.onComplete?.()
        return
      }

      // 3. SPECIAL HANDLING: Non-faststart M4A (ALAC/AAC with tail moov index)
      if (m4aInfo && !m4aInfo.isFastStart && m4aInfo.moovBox) {
        // Synthesize faststart header: [ftyp box] + [moov box]
        const syntheticLen = m4aInfo.ftypBox.length + m4aInfo.moovBox.length
        const syntheticHeader = new Uint8Array(syntheticLen)
        syntheticHeader.set(m4aInfo.ftypBox, 0)
        syntheticHeader.set(m4aInfo.moovBox, m4aInfo.ftypBox.length)

        // Initialize decoder with the moov table
        await dec(syntheticHeader)

        // Stream audio frames in on-demand 256KB Range chunks starting from mdat
        let currentByte = m4aInfo.audioStartOffset || 4096
        const totalSize = rangeSource.getFileSize()
        const CHUNK_SIZE = 262144 // 256KB

        try {
          while ((totalSize === 0 || currentByte < totalSize) && !signal.aborted) {
            // Flow control check:
            const bufferAhead = this.getDecodedDuration() - this.currentPlaybackTime
            if (bufferAhead >= this.maxBufferAhead) {
              console.log(
                `[AudioStream] ⏸️ Target 30s buffer reached (decoded: ${this.getDecodedDuration().toFixed(1)}s, ahead: ${bufferAhead.toFixed(1)}s). Throttling Range download.`
              )
              await this.waitForBufferDrain(signal)
              if (signal.aborted) break
              console.log(
                `[AudioStream] ▶️ Buffer drained to ${(this.getDecodedDuration() - this.currentPlaybackTime).toFixed(1)}s. Resuming Range download.`
              )
            }

            const endByte = totalSize > 0 ? Math.min(currentByte + CHUNK_SIZE - 1, totalSize - 1) : currentByte + CHUNK_SIZE - 1
            const chunkData = await rangeSource.readRange(currentByte, endByte, signal)
            if (!chunkData || chunkData.length === 0) break

            currentByte += chunkData.length

            const chunk = await dec(chunkData)
            if (chunk && chunk.channelData && chunk.channelData.length > 0) {
              const chunkSamples = chunk.channelData[0].length
              if (chunkSamples > 0) {
                this.sampleRate = chunk.sampleRate || this.sampleRate
                this.appendPCM(chunk.channelData, this.sampleRate)
                this.onChunk?.({
                  channelData: chunk.channelData,
                  sampleRate: this.sampleRate,
                  samplesDecoded: chunkSamples,
                })
              }
            }
          }

          if (!signal.aborted) {
            const flushed = await dec()
            if (flushed && flushed.channelData && flushed.channelData.length > 0) {
              const chunkSamples = flushed.channelData[0].length
              if (chunkSamples > 0) {
                this.sampleRate = flushed.sampleRate || this.sampleRate
                this.appendPCM(flushed.channelData, this.sampleRate)
                this.onChunk?.({
                  channelData: flushed.channelData,
                  sampleRate: this.sampleRate,
                  samplesDecoded: chunkSamples,
                })
              }
            }
          }
        } finally {
          dec?.free?.()
        }

        this.isDone = true
        if (this.knownDuration === 0 && this.sampleRate > 0) {
          this.knownDuration = this.totalSamplesDecoded / this.sampleRate
          this.onDuration?.(this.knownDuration)
        }
        this.onComplete?.()
        return
      }

      // 4. GENERAL HANDLING: Linear Stream or Fast-Start Container
      const response = await fetch(this.rawUrl, { signal })
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`)
      }

      if (!response.body) {
        const arrayBuf = await response.arrayBuffer()
        const result = await decode(arrayBuf)
        this.appendPCM(result.channelData, result.sampleRate)
        this.onChunk?.({
          channelData: result.channelData,
          sampleRate: result.sampleRate,
          samplesDecoded: result.channelData[0]?.length || 0,
        })
        this.isDone = true
        this.onComplete?.()
        return
      }

      const reader = response.body.getReader()

      try {
        while (true) {
          if (signal.aborted) break

          // Flow control: Check buffer ahead and apply TCP backpressure if buffer is full
          const bufferAhead = this.getDecodedDuration() - this.currentPlaybackTime
          if (bufferAhead >= this.maxBufferAhead) {
            console.log(
              `[AudioStream] ⏸️ Target 30s buffer reached (decoded: ${this.getDecodedDuration().toFixed(1)}s, ahead: ${bufferAhead.toFixed(1)}s). Throttling network stream.`
            )
            await this.waitForBufferDrain(signal)
            if (signal.aborted) break
            console.log(
              `[AudioStream] ▶️ Buffer drained to ${(this.getDecodedDuration() - this.currentPlaybackTime).toFixed(1)}s. Resuming network stream.`
            )
          }

          const { done, value } = await reader.read()
          if (done) break

          const uint8 = value instanceof Uint8Array ? value : new Uint8Array(value)
          const result = await dec(uint8)

          if (result && result.channelData && result.channelData.length > 0) {
            const chunkSamples = result.channelData[0].length
            if (chunkSamples > 0) {
              this.sampleRate = result.sampleRate || this.sampleRate
              this.appendPCM(result.channelData, this.sampleRate)

              this.onChunk?.({
                channelData: result.channelData,
                sampleRate: this.sampleRate,
                samplesDecoded: chunkSamples,
              })
            }
          }
        }

        if (!signal.aborted) {
          const flushed = await dec()
          if (flushed && flushed.channelData && flushed.channelData.length > 0) {
            const chunkSamples = flushed.channelData[0].length
            if (chunkSamples > 0) {
              this.sampleRate = flushed.sampleRate || this.sampleRate
              this.appendPCM(flushed.channelData, this.sampleRate)

              this.onChunk?.({
                channelData: flushed.channelData,
                sampleRate: this.sampleRate,
                samplesDecoded: chunkSamples,
              })
            }
          }
        }
      } finally {
        reader.cancel().catch(() => {})
        dec?.free?.()
      }

      this.isDone = true
      if (this.knownDuration === 0 && this.sampleRate > 0) {
        this.knownDuration = this.totalSamplesDecoded / this.sampleRate
        this.onDuration?.(this.knownDuration)
      }
      this.onComplete?.()
    } catch (err: unknown) {
      if (signal.aborted || (err instanceof Error && err.name === 'AbortError')) return
      console.error('[AudioStream] ❌ Streaming decoder error:', err)
      this.onError?.(err instanceof Error ? err : new Error(String(err)))
    }
  }

  private appendPCM(newChannels: Float32Array[], rate: number) {
    if (!newChannels || newChannels.length === 0) return
    const chunkLength = newChannels[0].length
    if (chunkLength === 0) return

    this.sampleRate = rate

    this.recentBlocks.push({
      startSample: this.totalSamplesDecoded,
      channelData: newChannels,
    })
    this.totalSamplesDecoded += chunkLength

    // Prune blocks older than 30s behind current playback time to bound RAM < 15MB
    const retainThresholdSample = Math.max(
      0,
      Math.floor((this.currentPlaybackTime - 30) * this.sampleRate)
    )

    while (
      this.recentBlocks.length > 1 &&
      this.recentBlocks[0].startSample + this.recentBlocks[0].channelData[0].length < retainThresholdSample
    ) {
      this.recentBlocks.shift()
    }
  }

  public abort(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    this.drainResolvers.forEach((resolve) => resolve())
    this.drainResolvers.clear()
  }

  public destroy(): void {
    this.abort()
    this.recentBlocks = []
    this.totalSamplesDecoded = 0
    this.isDone = true
  }
}
