/**
 * AudioWorklet Processor Source Code
 * Encapsulated as an inline string to enable instant Blob URL generation without external bundle dependencies.
 */
export const WORKLET_PROCESSOR_NAME = 'streaming-pcm-processor'

const WORKLET_PROCESSOR_CODE = `
class StreamingPCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.queue = []
    this.currentChunk = null
    this.readOffset = 0
    this.isPlaying = false
    this.isEndOfStream = false
    this.isBuffering = false
    this.totalSamplesPlayed = 0
    this.sampleRate = 44100
    this.lastReportSample = 0
    this.preBufferThreshold = 8820 // ~0.2s at 44.1kHz

    this.port.onmessage = (e) => {
      const msg = e.data
      if (!msg) return

      switch (msg.type) {
        case 'push': {
          if (msg.channelData && msg.channelData.length > 0) {
            this.queue.push(msg.channelData)
          }
          break
        }
        case 'play': {
          this.isPlaying = true
          break
        }
        case 'pause': {
          this.isPlaying = false
          break
        }
        case 'clear': {
          this.queue = []
          this.currentChunk = null
          this.readOffset = 0
          this.isEndOfStream = false
          this.isBuffering = false
          this.totalSamplesPlayed = typeof msg.seekSamples === 'number' ? msg.seekSamples : 0
          this.lastReportSample = this.totalSamplesPlayed
          break
        }
        case 'endOfStream': {
          this.isEndOfStream = true
          break
        }
        case 'init': {
          if (msg.sampleRate) {
            this.sampleRate = msg.sampleRate
            this.preBufferThreshold = Math.round(this.sampleRate * 0.2)
          }
          break
        }
      }
    }
  }

  getQueuedSampleCount() {
    let count = 0
    if (this.currentChunk) {
      count += this.currentChunk[0].length - this.readOffset
    }
    for (let i = 0; i < this.queue.length; i++) {
      count += this.queue[i][0].length
    }
    return count
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0]
    if (!output || output.length === 0) return true
    const numOutChannels = output.length
    const blockSize = output[0].length // 128 samples

    if (!this.isPlaying) {
      for (let ch = 0; ch < numOutChannels; ch++) {
        output[ch].fill(0)
      }
      return true
    }

    // Pre-buffer / buffering management
    const availableSamples = this.getQueuedSampleCount()
    if (this.isBuffering) {
      if (availableSamples >= this.preBufferThreshold || this.isEndOfStream) {
        this.isBuffering = false
        this.port.postMessage({ type: 'buffering', isBuffering: false })
      } else {
        for (let ch = 0; ch < numOutChannels; ch++) {
          output[ch].fill(0)
        }
        return true
      }
    } else if (availableSamples === 0) {
      if (this.isEndOfStream && !this.currentChunk) {
        // Track finished
        this.isPlaying = false
        for (let ch = 0; ch < numOutChannels; ch++) {
          output[ch].fill(0)
        }
        this.port.postMessage({ type: 'ended' })
        return true
      } else {
        // Starvation / network underrun
        this.isBuffering = true
        this.port.postMessage({ type: 'buffering', isBuffering: true })
        for (let ch = 0; ch < numOutChannels; ch++) {
          output[ch].fill(0)
        }
        return true
      }
    }

    let samplesWritten = 0

    while (samplesWritten < blockSize) {
      if (!this.currentChunk) {
        if (this.queue.length > 0) {
          this.currentChunk = this.queue.shift()
          this.readOffset = 0
        } else {
          break
        }
      }

      const chunkLength = this.currentChunk[0].length
      const chunkAvailable = chunkLength - this.readOffset
      const needed = blockSize - samplesWritten
      const toCopy = Math.min(chunkAvailable, needed)
      const chunkChannels = this.currentChunk.length

      for (let ch = 0; ch < numOutChannels; ch++) {
        const srcCh = this.currentChunk[ch % chunkChannels]
        const outCh = output[ch]
        for (let i = 0; i < toCopy; i++) {
          outCh[samplesWritten + i] = srcCh[this.readOffset + i]
        }
      }

      this.readOffset += toCopy
      samplesWritten += toCopy

      if (this.readOffset >= chunkLength) {
        this.currentChunk = null
        this.readOffset = 0
      }
    }

    // Fill remaining with silence if chunk ended mid-block
    if (samplesWritten < blockSize) {
      for (let ch = 0; ch < numOutChannels; ch++) {
        output[ch].fill(0, samplesWritten, blockSize)
      }
    }

    this.totalSamplesPlayed += samplesWritten

    // Accurate time report every ~4096 samples (~92ms at 44.1kHz)
    if (this.totalSamplesPlayed - this.lastReportSample >= 4096) {
      this.lastReportSample = this.totalSamplesPlayed
      this.port.postMessage({
        type: 'timeupdate',
        currentTime: this.totalSamplesPlayed / this.sampleRate,
      })
    }

    return true
  }
}

registerProcessor('${WORKLET_PROCESSOR_NAME}', StreamingPCMProcessor)
`

let cachedBlobUrl: string | null = null

export function getWorkletBlobUrl(): string {
  if (!cachedBlobUrl) {
    const blob = new Blob([WORKLET_PROCESSOR_CODE], { type: 'application/javascript' })
    cachedBlobUrl = URL.createObjectURL(blob)
  }
  return cachedBlobUrl
}
