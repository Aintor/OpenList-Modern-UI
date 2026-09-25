/**
 * Audiophile-Grade Bandlimited Windowed-Sinc (Lanczos-3) Audio Resampler
 * Converts multi-channel Float32Array audio between arbitrary sample rates with ideal anti-aliasing filtering.
 */

function sinc(x: number): number {
  if (Math.abs(x) < 1e-7) return 1.0
  const pix = Math.PI * x
  return Math.sin(pix) / pix
}

function lanczos(x: number, a: number): number {
  if (Math.abs(x) >= a) return 0
  return sinc(x) * sinc(x / a)
}

/**
 * Resamples multi-channel PCM audio using Bandlimited Lanczos-3 Windowed Sinc Interpolation.
 * When downsampling (fromSampleRate > toSampleRate), dynamically applies an anti-aliasing Nyquist filter.
 */
export function resamplePCM(
  inputChannels: Float32Array[],
  fromSampleRate: number,
  toSampleRate: number
): Float32Array[] {
  if (
    !inputChannels ||
    inputChannels.length === 0 ||
    fromSampleRate <= 0 ||
    toSampleRate <= 0 ||
    fromSampleRate === toSampleRate
  ) {
    return inputChannels
  }

  const inLength = inputChannels[0].length
  if (inLength === 0) return inputChannels

  const ratio = fromSampleRate / toSampleRate
  const outLength = Math.round(inLength / ratio)
  if (outLength === 0) return inputChannels

  const numChannels = inputChannels.length
  const outputChannels: Float32Array[] = new Array(numChannels)
  for (let ch = 0; ch < numChannels; ch++) {
    outputChannels[ch] = new Float32Array(outLength)
  }

  // Lanczos kernel radius a = 3 (6 taps for upsampling, widened for downsampling)
  const a = 3
  const cutoff = Math.min(1.0, 1.0 / ratio)
  const filterRadius = Math.ceil(a / cutoff)
  const maxTaps = filterRadius * 2 + 4
  const tapIndices = new Int32Array(maxTaps)
  const tapWeights = new Float64Array(maxTaps)

  for (let i = 0; i < outLength; i++) {
    const center = i * ratio
    const minIdx = Math.floor(center - filterRadius)
    const maxIdx = Math.ceil(center + filterRadius)

    let tapCount = 0
    let weightSum = 0

    for (let j = minIdx; j <= maxIdx; j++) {
      const dist = (j - center) * cutoff
      if (Math.abs(dist) < a) {
        const w = cutoff * lanczos(dist, a)
        tapIndices[tapCount] = Math.max(0, Math.min(inLength - 1, j))
        tapWeights[tapCount] = w
        weightSum += w
        tapCount++
      }
    }

    const norm = weightSum > 0 ? 1 / weightSum : 1

    for (let ch = 0; ch < numChannels; ch++) {
      const inData = inputChannels[ch]
      let sampleSum = 0
      for (let k = 0; k < tapCount; k++) {
        sampleSum += inData[tapIndices[k]] * tapWeights[k]
      }
      outputChannels[ch][i] = sampleSum * norm
    }
  }

  return outputChannels
}
