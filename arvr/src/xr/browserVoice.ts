/**
 * Browser speech synthesis as the fallback voice: used when the backend voice-over is not available
 * (no key configured, offline, rate-limited), so narration still works. Separate from the tour narration store.
 */
const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined

function pickVoice(lang: 'en' | 'id'): SpeechSynthesisVoice | null {
  const voices = synth?.getVoices() ?? []
  const want = lang === 'id' ? /^(id|in)\b/i : /^en\b/i
  const matches = voices.filter((v) => want.test(v.lang))
  return matches.find((v) => /natural|google|microsoft/i.test(v.name)) ?? matches.find((v) => v.localService) ?? matches[0] ?? null
}

export function hasBrowserVoice() {
  return !!synth && typeof SpeechSynthesisUtterance !== 'undefined'
}

export function stopBrowserVoice() {
  synth?.cancel()
}

/** Resolves when the text has been spoken (or was stopped); rejects when the browser cannot speak. */
export function speakWithBrowser(text: string, lang: 'en' | 'id'): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return reject(new Error('This browser has no speech synthesis.'))
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    const voice = pickVoice(lang)
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    } else {
      utterance.lang = lang === 'id' ? 'id-ID' : 'en-US'
    }
    utterance.rate = 0.98
    utterance.onend = () => resolve()
    utterance.onerror = (event) => (event.error === 'canceled' || event.error === 'interrupted' ? resolve() : reject(new Error(`Browser voice failed: ${event.error}`)))
    synth.speak(utterance)
  })
}

// Chrome loads voices asynchronously; touching the list early makes them ready by the first click.
synth?.getVoices()
