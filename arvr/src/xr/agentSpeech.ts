let audioContext: AudioContext | null = null
let activeSource: AudioBufferSourceNode | null = null

function getAudioContext() {
  if (typeof window === 'undefined' || !window.AudioContext) {
    throw new Error('Web Audio is not available in this browser.')
  }
  audioContext ??= new window.AudioContext()
  return audioContext
}

export function unlockAgentSpeech() {
  try {
    const context = getAudioContext()
    if (context.state === 'suspended') void context.resume().catch(() => undefined)
  } catch {
    // Audio support is reported by the narration status in the object panel.
  }
}

export function stopAgentSpeech() {
  const source = activeSource
  activeSource = null
  if (source) source.stop()
}

export async function playAgentSpeech(blob: Blob, signal?: AbortSignal) {
  const context = getAudioContext()
  await context.resume()
  const buffer = await context.decodeAudioData(await blob.arrayBuffer())
  if (signal?.aborted) return

  stopAgentSpeech()
  const source = context.createBufferSource()
  source.buffer = buffer
  source.connect(context.destination)
  activeSource = source
  await new Promise<void>((resolve) => {
    source.onended = () => {
      if (activeSource === source) activeSource = null
      resolve()
    }
    source.start()
  })
}
