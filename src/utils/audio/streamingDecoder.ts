import decode from 'audio-decode'
import * as mm from 'music-metadata'
import { AudioPCMChunk } from './types'
import { RangeSource, detectFormatFromMagicBytes } from './rangeSource'

export interface StreamingDecoderOptions {
  maxBufferAhead?: number // Target maximum buffer ahead in seconds (default: 30)
  minBufferAhead?: number // Minimum buffer ahead before resuming download (default: 15)
}

/**
 * Streaming Decoder Session with Universal Range-Broker & Sliding Window Backpressure Control
 * Translates decoder requirements into on-demand HTTP Range requests.
 * Automatically handles magic-byte detection, tail moov extraction, and flow control.
 */
export class StreamingDecoderSession {
  private abortController: AbortController | null = null
  private accumulatedChannels: Float32Array[] = []
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
   * Returns a copy of decoded PCM starting from startSample to the end of accumulated buffer
   */
  public getSliceFromSample(startSample: number): Float32Array[] | null {
    if (this.accumulatedChannels.length === 0) return null
    if (startSample >= this.totalSamplesDecoded) return null

    const safeStart = Math.max(0, Math.floor(startSample))
    const remaining = this.totalSamplesDecoded - safeStart
    if (remaining <= 0) return null

    return this.accumulatedChannels.map((ch) => ch.slice(safeStart))
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
      const probeResp = await fetch(this.rawUrl, {
        headers: { Range: 'bytes=0-131072' }, // Probe first 128KB
        signal,
      })

      if (probeResp.ok || probeResp.status === 206) {
        let uint8: Uint8Array | null = null

        if (probeResp.status === 206 || !probeResp.body) {
          const buf = await probeResp.arrayBuffer()
          uint8 = new Uint8Array(buf)
        } else {
          // If server returned 200 (ignored Range), read ONLY first 128KB and immediately cancel!
          const reader = probeResp.body.getReader()
          try {
            const { value } = await reader.read()
            uint8 = value ? value.subarray(0, 131072) : null
          } finally {
            reader.cancel().catch(() => {})
          }
        }

        if (uint8) {
          const detectedFormat = detectFormatFromMagicBytes(uint8)
          const ext = detectedFormat || this.filename.toLowerCase().split('.').pop() || 'flac'
          const meta = await mm.parseBuffer(uint8, {
            path: this.filename,
            size: this.estimatedSize || undefined,
            mimeType: `audio/${ext}`,
          })

          if (meta.format.duration && meta.format.duration > 0) {
            this.knownDuration = meta.format.duration
            if (meta.format.sampleRate) {
              this.sampleRate = meta.format.sampleRate
            }
            this.onDuration?.(this.knownDuration)
          }
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
      const codecInit = (decode as Record<string, any>)[formatName] || (decode as Record<string, any>)['flac']
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
    } catch (err: any) {
      if (signal.aborted || err?.name === 'AbortError') return
      console.error('[AudioStream] ❌ Streaming decoder error:', err)
      this.onError?.(err instanceof Error ? err : new Error(String(err)))
    }
  }

  private appendPCM(newChannels: Float32Array[], rate: number) {
    if (!newChannels || newChannels.length === 0) return
    const chunkLength = newChannels[0].length
    if (chunkLength === 0) return

    this.sampleRate = rate

    if (this.accumulatedChannels.length === 0) {
      this.accumulatedChannels = newChannels.map((ch) => new Float32Array(ch))
      this.totalSamplesDecoded = chunkLength
      return
    }

    const numChannels = Math.max(this.accumulatedChannels.length, newChannels.length)
    const newTotal = this.totalSamplesDecoded + chunkLength

    const nextChannels: Float32Array[] = []
    for (let ch = 0; ch < numChannels; ch++) {
      const prev = this.accumulatedChannels[ch % this.accumulatedChannels.length]
      const next = newChannels[ch % newChannels.length]
      const merged = new Float32Array(newTotal)
      merged.set(prev, 0)
      merged.set(next, this.totalSamplesDecoded)
      nextChannels.push(merged)
    }

    this.accumulatedChannels = nextChannels
    this.totalSamplesDecoded = newTotal
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
    this.accumulatedChannels = []
    this.totalSamplesDecoded = 0
    this.isDone = true
  }
}
