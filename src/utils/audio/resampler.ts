/**
 * High-performance Linear PCM Audio Resampler
 * Converts multi-channel Float32Array audio from any source sampleRate to target AudioContext.sampleRate
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
    const inData = inputChannels[ch]
    const outData = new Float32Array(outLength)

    for (let i = 0; i < outLength; i++) {
      const pos = i * ratio
      const idx = Math.floor(pos)
      const frac = pos - idx

      const s0 = inData[idx] ?? 0
      const s1 = idx + 1 < inLength ? inData[idx + 1] : s0

      outData[i] = s0 + frac * (s1 - s0)
    }

    outputChannels[ch] = outData
  }

  return outputChannels
}
