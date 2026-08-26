import { AudioPCMChunk } from './types'
import { resamplePCM } from './resampler'
import { getWorkletBlobUrl, WORKLET_PROCESSOR_NAME } from './workletProcessor'
import { StreamingDecoderSession } from './streamingDecoder'

/**
 * Streaming WebAudio + AudioWorklet + WASM Decoder Player
 * Provides true progressive playback (play-as-you-download) with low latency for non-native audio formats.
 */
export class WebAudioStreamPlayer {
  private ctx: AudioContext | null = null
  private gainNode: GainNode | null = null
  private workletNode: AudioWorkletNode | null = null
  private isWorkletReady = false
  private isPlaying = false
  private currentVolume = 1
  private isMuted = false
  private currentTime = 0
  private duration = 0

  private currentSession: StreamingDecoderSession | null = null
  private isDestroyed = false

  public onTimeUpdate?: (currentTime: number, duration: number) => void
  public onBuffering?: (isBuffering: boolean) => void
  public onEnded?: () => void
  public onError?: (error: Error) => void

  private getAudioContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new AudioCtx()
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  private async ensureWorkletNode(): Promise<AudioWorkletNode> {
    const ctx = this.getAudioContext()

    if (!this.isWorkletReady) {
      const blobUrl = getWorkletBlobUrl()
      await ctx.audioWorklet.addModule(blobUrl)
      this.isWorkletReady = true
    }

    if (!this.workletNode) {
      const node = new AudioWorkletNode(ctx, WORKLET_PROCESSOR_NAME, {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      })

      const gain = ctx.createGain()
      gain.gain.value = this.isMuted ? 0 : this.currentVolume
      node.connect(gain)
      gain.connect(ctx.destination)

      node.port.onmessage = (e) => {
        const msg = e.data
        if (!msg) return

        if (msg.type === 'timeupdate') {
          this.currentTime = msg.currentTime
          this.currentSession?.updatePlaybackTime(this.currentTime)
          this.onTimeUpdate?.(this.currentTime, this.duration)
        } else if (msg.type === 'buffering') {
          this.onBuffering?.(msg.isBuffering)
        } else if (msg.type === 'ended') {
          this.isPlaying = false
          this.onEnded?.()
        }
      }

      node.port.postMessage({ type: 'init', sampleRate: ctx.sampleRate })

      this.gainNode = gain
      this.workletNode = node
    }

    return this.workletNode
  }

  public async loadAndPlay(
    rawUrl: string,
    filename: string = '',
    size: number = 0,
    startTime: number = 0,
    autoPlay: boolean = true
  ): Promise<void> {
    this.stop()

    this.currentTime = startTime
    this.duration = 0
    this.isPlaying = autoPlay

    const ctx = this.getAudioContext()
    const worklet = await this.ensureWorkletNode()

    // Clear worklet buffer and seek offset
    worklet.port.postMessage({
      type: 'clear',
      seekSamples: Math.round(startTime * ctx.sampleRate),
    })

    if (autoPlay) {
      worklet.port.postMessage({ type: 'play' })
    }

    console.log(`[AudioEngine:WebAudio] 🚀 Starting WebAudio WASM stream: "${filename}" (start: ${startTime}s)`)

    // Initialize Streaming Decoder Session
    const session = new StreamingDecoderSession(rawUrl, filename, size)
    this.currentSession = session

    session.onChunk = (chunk: AudioPCMChunk) => {
      if (this.isDestroyed || this.currentSession !== session) return

      const sourceRate = chunk.sampleRate
      const targetRate = ctx.sampleRate

      // Realtime Resample to hardware sample rate
      const resampledChannels =
        sourceRate !== targetRate
          ? resamplePCM(chunk.channelData, sourceRate, targetRate)
          : chunk.channelData

      worklet.port.postMessage({
        type: 'push',
        channelData: resampledChannels,
      })

      // Update estimated duration if not yet known
      if (this.duration === 0) {
        const decodedDur = session.getDecodedDuration()
        if (decodedDur > this.currentTime) {
          this.onTimeUpdate?.(this.currentTime, session.getKnownDuration() || decodedDur)
        }
      }
    }

    session.onDuration = (dur: number) => {
      if (this.isDestroyed || this.currentSession !== session) return
      this.duration = dur
      this.onTimeUpdate?.(this.currentTime, this.duration)
    }

    session.onComplete = () => {
      if (this.isDestroyed || this.currentSession !== session) return
      if (this.duration === 0) {
        this.duration = session.getDecodedDuration()
        this.onTimeUpdate?.(this.currentTime, this.duration)
      }
      worklet.port.postMessage({ type: 'endOfStream' })
    }

    session.onError = (err: Error) => {
      if (this.isDestroyed || this.currentSession !== session) return
      this.onError?.(err)
    }

    // Start background streaming
    session.start().catch((err) => {
      this.onError?.(err instanceof Error ? err : new Error(String(err)))
    })
  }

  public async play(): Promise<void> {
    this.isPlaying = true
    const ctx = this.getAudioContext()
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'play' })
    }
  }

  public pause(): void {
    this.isPlaying = false
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'pause' })
    }
  }

  public seek(timeInSeconds: number): void {
    this.currentTime = Math.max(0, timeInSeconds)
    this.currentSession?.notifySeek(this.currentTime)
    const ctx = this.getAudioContext()
    const targetHardwareSample = Math.round(this.currentTime * ctx.sampleRate)

    if (!this.workletNode) return

    // 1. Clear worklet queue and reset sample counter
    this.workletNode.port.postMessage({
      type: 'clear',
      seekSamples: targetHardwareSample,
    })

    // 2. Check if seek target is within already-decoded in-memory PCM
    if (this.currentSession) {
      const sourceRate = this.currentSession.getSampleRate()
      const targetSourceSample = Math.round(this.currentTime * sourceRate)
      const cachedSlice = this.currentSession.getSliceFromSample(targetSourceSample)

      if (cachedSlice && cachedSlice.length > 0) {
        // Fast 0ms instant seek from cache
        const resampled =
          sourceRate !== ctx.sampleRate
            ? resamplePCM(cachedSlice, sourceRate, ctx.sampleRate)
            : cachedSlice

        this.workletNode.port.postMessage({
          type: 'push',
          channelData: resampled,
        })

        if (this.currentSession.isComplete()) {
          this.workletNode.port.postMessage({ type: 'endOfStream' })
        }
      }
    }

    if (this.isPlaying) {
      this.workletNode.port.postMessage({ type: 'play' })
    }
  }

  public setVolume(volume: number): void {
    this.currentVolume = Math.max(0, Math.min(1, volume))
    if (this.gainNode) {
      this.gainNode.gain.value = this.isMuted ? 0 : this.currentVolume
    }
  }

  public setMuted(isMuted: boolean): void {
    this.isMuted = isMuted
    if (this.gainNode) {
      this.gainNode.gain.value = this.isMuted ? 0 : this.currentVolume
    }
  }

  public getCurrentTime(): number {
    return this.currentTime
  }

  public getDuration(): number {
    return this.duration
  }

  public isPaused(): boolean {
    return !this.isPlaying
  }

  public stop(): void {
    this.isPlaying = false
    if (this.currentSession) {
      this.currentSession.destroy()
      this.currentSession = null
    }
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'clear' })
      this.workletNode.port.postMessage({ type: 'pause' })
    }
  }

  public destroy(): void {
    this.isDestroyed = true
    this.stop()
    if (this.workletNode) {
      try {
        this.workletNode.disconnect()
      } catch {}
      this.workletNode = null
    }
    if (this.gainNode) {
      try {
        this.gainNode.disconnect()
      } catch {}
      this.gainNode = null
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        this.ctx.close()
      } catch {}
      this.ctx = null
    }
  }
}
