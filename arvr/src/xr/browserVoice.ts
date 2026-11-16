/** Browser speech synthesis fallback for narration when backend-generated audio is unavailable. */
const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = synth?.getVoices() ?? []
  const matches = voices.filter((v) => /^en\b/i.test(v.lang))
  return matches.find((v) => /natural|google|microsoft/i.test(v.name)) ?? matches.find((v) => v.localService) ?? matches[0] ?? null
}

export function hasBrowserVoice() {
  return !!synth && typeof SpeechSynthesisUtterance !== 'undefined'
}

export function stopBrowserVoice() {
  synth?.cancel()
}

/** Resolves when the text has been spoken (or was stopped); rejects when the browser cannot speak. */
export function speakWithBrowser(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return reject(new Error('This browser has no speech synthesis.'))
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    const voice = pickVoice()
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    } else {
      utterance.lang = 'en-US'
    }
    utterance.rate = 0.98
    utterance.onend = () => resolve()
    utterance.onerror = (event) => (event.error === 'canceled' || event.error === 'interrupted' ? resolve() : reject(new Error(`Browser voice failed: ${event.error}`)))
    synth.speak(utterance)
  })
}

// Chrome loads voices asynchronously; touching the list early makes them ready by the first click.
synth?.getVoices()
