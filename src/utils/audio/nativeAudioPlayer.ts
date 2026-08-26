/**
 * Native HTML5 Audio Player Wrapper
 * Encapsulates HTMLMediaElement progressive streaming, event listening, and playback lifecycle.
 */
export class NativeAudioPlayer {
  private audio: HTMLAudioElement | null = null
  private isDestroyed = false

  public onTimeUpdate?: (currentTime: number, duration: number) => void
  public onBuffering?: (isBuffering: boolean) => void
  public onEnded?: () => void
  public onError?: (error: MediaError | null, code: number) => void
  public onCanPlay?: () => void

  constructor() {
    this.initAudio()
  }

  private initAudio() {
    if (typeof window === 'undefined') return
    const audio = new Audio()
    audio.preload = 'auto'

    audio.ontimeupdate = () => {
      if (this.isDestroyed || !this.audio) return
      this.onTimeUpdate?.(this.audio.currentTime, this.audio.duration || 0)
    }

    audio.onloadedmetadata = () => {
      if (this.isDestroyed || !this.audio) return
      this.onTimeUpdate?.(this.audio.currentTime, this.audio.duration || 0)
    }

    audio.onwaiting = () => {
      if (this.isDestroyed) return
      this.onBuffering?.(true)
    }

    audio.onplaying = () => {
      if (this.isDestroyed) return
      console.log(`[AudioEngine:Native] ▶️ HTML5 Audio playing: "${this.audio?.src.split('?')[0].split('/').pop()}"`)
      this.onBuffering?.(false)
    }

    audio.oncanplay = () => {
      if (this.isDestroyed) return
      this.onBuffering?.(false)
      this.onCanPlay?.()
    }

    audio.onended = () => {
      if (this.isDestroyed) return
      this.onEnded?.()
    }

    audio.onerror = () => {
      if (this.isDestroyed || !this.audio) return
      const err = this.audio.error
      console.warn(`[AudioEngine:Native] ⚠️ HTML5 Audio error (code ${err?.code}): "${err?.message || 'Media decode failure'}"`)
      this.onError?.(err, err?.code || 0)
    }

    this.audio = audio
  }

  public setSource(rawUrl: string, volume = 1, isMuted = false): void {
    if (!this.audio) return
    this.audio.src = rawUrl
    this.audio.volume = isMuted ? 0 : volume
    this.audio.muted = isMuted
  }

  public async play(): Promise<void> {
    if (!this.audio) return
    try {
      await this.audio.play()
    } catch (e) {
      // Ignore AbortError / user pause interruptions
    }
  }

  public pause(): void {
    if (!this.audio) return
    this.audio.pause()
  }

  public seek(time: number): void {
    if (!this.audio) return
    try {
      this.audio.currentTime = time
    } catch {}
  }

  public setVolume(volume: number): void {
    if (!this.audio) return
    this.audio.volume = Math.max(0, Math.min(1, volume))
  }

  public setMuted(isMuted: boolean): void {
    if (!this.audio) return
    this.audio.muted = isMuted
  }

  public getCurrentTime(): number {
    return this.audio?.currentTime || 0
  }

  public getDuration(): number {
    return this.audio?.duration || 0
  }

  public isPaused(): boolean {
    return this.audio ? this.audio.paused : true
  }

  public stop(): void {
    if (!this.audio) return
    this.audio.pause()
    this.audio.removeAttribute('src')
    this.audio.load()
  }

  public destroy(): void {
    this.isDestroyed = true
    if (this.audio) {
      this.audio.pause()
      this.audio.ontimeupdate = null
      this.audio.onloadedmetadata = null
      this.audio.onwaiting = null
      this.audio.onplaying = null
      this.audio.oncanplay = null
      this.audio.onended = null
      this.audio.onerror = null
      this.audio.removeAttribute('src')
      this.audio.load()
      this.audio = null
    }
  }
}
