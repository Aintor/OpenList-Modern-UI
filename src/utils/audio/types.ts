export type AudioEngineMode = 'native' | 'webaudio-stream' | 'none'

export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'buffering' | 'error'

export interface AudioSourceInfo {
  rawUrl: string
  name?: string
  size?: number
  duration?: number
}

export interface AudioPCMChunk {
  channelData: Float32Array[]
  sampleRate: number
  samplesDecoded?: number
}

export interface TimeUpdateData {
  currentTime: number
  duration: number
}

export interface AudioEngineEvents {
  timeupdate: (data: TimeUpdateData) => void
  statechange: (state: PlaybackState) => void
  modechange: (mode: AudioEngineMode) => void
  buffering: (isBuffering: boolean) => void
  ended: () => void
  error: (error: Error) => void
}

export type AudioEngineEventName = keyof AudioEngineEvents
