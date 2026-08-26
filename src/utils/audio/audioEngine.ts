import {
  AudioEngineEvents,
  AudioEngineEventName,
  AudioEngineMode,
  AudioSourceInfo,
  PlaybackState,
} from './types'
import { NativeAudioPlayer } from './nativeAudioPlayer'
import { WebAudioStreamPlayer } from './webAudioStreamPlayer'

/**
 * Checks if browser can natively play given audio MIME / extension
 */
function isNativelyPlayable(filename: string): boolean {
  if (typeof window === 'undefined') return true
  const ext = filename.toLowerCase().split('.').pop() || ''

  // Formats guaranteed to be natively playable in all modern browsers (Chrome, Safari, Firefox, Edge)
  const ALWAYS_NATIVE = new Set(['mp3', 'm4a', 'aac', 'wav', 'mp4'])
  if (ALWAYS_NATIVE.has(ext)) return true

  // FLAC: Supported natively in Chrome, Firefox, Edge, and Safari (macOS 10.13+ / iOS 11+)
  if (ext === 'flac') {
    const audio = document.createElement('audio')
    return audio.canPlayType('audio/flac') !== ''
  }

  // OGG / Opus: Supported in Chrome, Firefox, Edge, but not Safari
  if (ext === 'ogg' || ext === 'oga' || ext === 'opus') {
    const audio = document.createElement('audio')
    const canOgg = audio.canPlayType('audio/ogg; codecs="vorbis"') !== ''
    const canOpus =
      audio.canPlayType('audio/ogg; codecs="opus"') !== '' ||
      audio.canPlayType('audio/opus') !== ''
    return canOgg || canOpus
  }

  return false
}

/**
 * Unified Audio Engine
 * Automatically routes and gracefully falls back between Native HTML5 Audio and WebAudio+WASM Streaming Pipelines.
 */
export class AudioEngine {
  private nativePlayer: NativeAudioPlayer
  private webAudioPlayer: WebAudioStreamPlayer

  private currentMode: AudioEngineMode = 'none'
  private currentState: PlaybackState = 'idle'
  private currentVolume = 1
  private currentMuted = false
  private currentTime = 0
  private duration = 0
  private currentSource: AudioSourceInfo | null = null

  private listeners: {
    [K in AudioEngineEventName]?: Set<AudioEngineEvents[K]>
  } = {}

  constructor() {
    this.nativePlayer = new NativeAudioPlayer()
    this.webAudioPlayer = new WebAudioStreamPlayer()

    this.bindNativeEvents()
    this.bindWebAudioEvents()
  }

  private bindNativeEvents() {
    this.nativePlayer.onTimeUpdate = (cur, dur) => {
      if (this.currentMode !== 'native') return
      this.currentTime = cur
      if (dur > 0) this.duration = dur
      this.emit('timeupdate', { currentTime: this.currentTime, duration: this.duration })
    }

    this.nativePlayer.onBuffering = (buffering) => {
      if (this.currentMode !== 'native') return
      this.setState(buffering ? 'buffering' : 'playing')
      this.emit('buffering', buffering)
    }

    this.nativePlayer.onEnded = () => {
      if (this.currentMode !== 'native') return
      this.setState('idle')
      this.emit('ended')
    }

    this.nativePlayer.onError = (_err, code) => {
      if (this.currentMode !== 'native') return

      // Code 4: MEDIA_ERR_SRC_NOT_SUPPORTED -> Seamless fallback to WebAudio Streaming WASM engine
      if (code === 4 && this.currentSource) {
        this.fallbackToWebAudio(this.currentSource, this.currentTime)
      } else {
        this.setState('error')
        this.emit('error', new Error(`Native playback error (code ${code})`))
      }
    }
  }

  private bindWebAudioEvents() {
    this.webAudioPlayer.onTimeUpdate = (cur, dur) => {
      if (this.currentMode !== 'webaudio-stream') return
      this.currentTime = cur
      if (dur > 0) this.duration = dur
      this.emit('timeupdate', { currentTime: this.currentTime, duration: this.duration })
    }

    this.webAudioPlayer.onBuffering = (buffering) => {
      if (this.currentMode !== 'webaudio-stream') return
      this.setState(buffering ? 'buffering' : 'playing')
      this.emit('buffering', buffering)
    }

    this.webAudioPlayer.onEnded = () => {
      if (this.currentMode !== 'webaudio-stream') return
      this.setState('idle')
      this.emit('ended')
    }

    this.webAudioPlayer.onError = (err) => {
      if (this.currentMode !== 'webaudio-stream') return
      this.setState('error')
      this.emit('error', err)
    }
  }

  private fallbackToWebAudio(source: AudioSourceInfo, offset: number = 0) {
    console.log(`[AudioEngine] 🔄 Automatically falling back to WebAudio WASM Engine for: "${source.name}" (offset: ${offset}s)`)
    this.nativePlayer.stop()
    this.setMode('webaudio-stream')
    this.setState('loading')

    this.webAudioPlayer
      .loadAndPlay(source.rawUrl, source.name, source.size, offset, true)
      .then(() => {
        this.setState('playing')
      })
      .catch((err) => {
        this.setState('error')
        this.emit('error', err)
      })
  }

  public on<K extends AudioEngineEventName>(event: K, listener: AudioEngineEvents[K]): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set() as any
    }
    this.listeners[event]!.add(listener)
    return () => this.off(event, listener)
  }

  public off<K extends AudioEngineEventName>(event: K, listener: AudioEngineEvents[K]): void {
    this.listeners[event]?.delete(listener)
  }

  private emit<K extends AudioEngineEventName>(
    event: K,
    ...args: Parameters<AudioEngineEvents[K]>
  ): void {
    const handlers = this.listeners[event]
    if (handlers) {
      handlers.forEach((fn: any) => {
        try {
          fn(...args)
        } catch (e) {
          console.error(`[AudioEngine] Error in '${event}' listener:`, e)
        }
      })
    }
  }

  private setMode(mode: AudioEngineMode) {
    if (this.currentMode !== mode) {
      this.currentMode = mode
      this.emit('modechange', mode)
    }
  }

  private setState(state: PlaybackState) {
    if (this.currentState !== state) {
      this.currentState = state
      this.emit('statechange', state)
    }
  }

  public getMode(): AudioEngineMode {
    return this.currentMode
  }

  public getState(): PlaybackState {
    return this.currentState
  }

  public getCurrentTime(): number {
    return this.currentTime
  }

  public getDuration(): number {
    return this.duration
  }

  public async play(source: AudioSourceInfo, startTime: number = 0): Promise<void> {
    // Prevent duplicate restart if the exact same track is already playing
    if (
      this.currentSource?.rawUrl === source.rawUrl &&
      this.currentState === 'playing' &&
      startTime === 0
    ) {
      return
    }

    this.currentSource = source
    this.currentTime = startTime
    this.duration = source.duration || 0
    this.setState('loading')

    const filename = source.name || ''
    const preferNative = isNativelyPlayable(filename)
    console.log(`[AudioEngine] 🎵 Track requested: "${filename}" | Preferred Mode: ${preferNative ? 'Native HTML5' : 'WebAudio WASM Stream'}`)

    if (preferNative) {
      this.webAudioPlayer.stop()
      this.setMode('native')
      this.nativePlayer.setSource(source.rawUrl, this.currentVolume, this.currentMuted)
      if (startTime > 0) {
        this.nativePlayer.seek(startTime)
      }
      try {
        await this.nativePlayer.play()
        this.setState('playing')
      } catch (err: any) {
        if (err?.name === 'NotAllowedError') {
          // Autoplay policy prevented playback until user clicks - DO NOT fallback to WASM!
          this.setState('paused')
        } else {
          // Fallback to streaming WebAudio if native play fails on media error
          this.fallbackToWebAudio(source, startTime)
        }
      }
    } else {
      // Non-native format (e.g. FLAC on Safari, OGG on iOS, APE, WMA) -> Direct WASM Stream
      this.nativePlayer.stop()
      this.setMode('webaudio-stream')
      try {
        await this.webAudioPlayer.loadAndPlay(
          source.rawUrl,
          filename,
          source.size,
          startTime,
          true
        )
        this.setState('playing')
      } catch (err: any) {
        this.setState('error')
        this.emit('error', err instanceof Error ? err : new Error(String(err)))
      }
    }
  }

  public async resume(): Promise<void> {
    if (this.currentMode === 'native') {
      await this.nativePlayer.play()
      this.setState('playing')
    } else if (this.currentMode === 'webaudio-stream') {
      await this.webAudioPlayer.play()
      this.setState('playing')
    }
  }

  public pause(): void {
    if (this.currentMode === 'native') {
      this.nativePlayer.pause()
      this.setState('paused')
    } else if (this.currentMode === 'webaudio-stream') {
      this.webAudioPlayer.pause()
      this.setState('paused')
    }
  }

  public seek(timeInSeconds: number): void {
    this.currentTime = Math.max(0, timeInSeconds)
    if (this.currentMode === 'native') {
      this.nativePlayer.seek(this.currentTime)
    } else if (this.currentMode === 'webaudio-stream') {
      this.webAudioPlayer.seek(this.currentTime)
    }
    this.emit('timeupdate', { currentTime: this.currentTime, duration: this.duration })
  }

  public setVolume(volume: number): void {
    this.currentVolume = Math.max(0, Math.min(1, volume))
    this.nativePlayer.setVolume(this.currentVolume)
    this.webAudioPlayer.setVolume(this.currentVolume)
  }

  public setMuted(isMuted: boolean): void {
    this.currentMuted = isMuted
    this.nativePlayer.setMuted(isMuted)
    this.webAudioPlayer.setMuted(isMuted)
  }

  public stop(): void {
    this.nativePlayer.stop()
    this.webAudioPlayer.stop()
    this.currentSource = null
    this.setMode('none')
    this.setState('idle')
  }

  public destroy(): void {
    this.stop()
    this.nativePlayer.destroy()
    this.webAudioPlayer.destroy()
    this.listeners = {}
  }
}

// Global Singleton Instance
export const globalAudioEngine = new AudioEngine()
