import { useCallback, useEffect, useRef, useState } from 'react'
import { requestAgentSpeech } from '../api'
import { playAgentSpeech, stopAgentSpeech, unlockAgentSpeech } from '../../xr/agentSpeech'
import type { ChatMessage } from './guideStore'

const STORAGE_KEY = 'cosmic-guide-voice'
/** keep a spoken answer short enough for one voice-over request */
const MAX_SPOKEN_CHARS = 900

export type GuideVoiceStatus = 'idle' | 'loading' | 'playing' | 'error'

/** Markdown -> plain sentences, so the voice does not read symbols aloud. */
function toSpokenText(markdown: string) {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_`~|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > MAX_SPOKEN_CHARS ? `${text.slice(0, MAX_SPOKEN_CHARS).replace(/\s+\S*$/, '')}…` : text
}

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

/**
 * Voice for the Cosmic Guide window: while the toggle is on, each new answer from the agent is read aloud through
 * the same agentic voice-over as the object card (/api/agent/voiceover/text). Off by default; the choice is remembered.
 */
export function useGuideSpeech(messages: ChatMessage[], lang: string, active: boolean) {
  const [enabled, setEnabled] = useState(readStored)
  const [status, setStatus] = useState<GuideVoiceStatus>('idle')
  const last = messages[messages.length - 1]
  const lastAssistant = last?.role === 'assistant' ? last : null
  // an answer that is already on screen when the window mounts is not read back
  const spokenId = useRef<string | null>(lastAssistant?.id ?? null)
  const run = useRef(0)

  const stop = useCallback(() => {
    run.current++
    stopAgentSpeech()
    setStatus('idle')
  }, [])

  const toggle = useCallback(() => {
    setEnabled((on) => {
      const next = !on
      try {
        localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off')
      } catch {
        // private mode: the toggle still works for this visit
      }
      if (next) unlockAgentSpeech() // this click is the gesture browsers need before audio can play
      return next
    })
  }, [])

  // answers already on screen when the voice is switched on are not read back
  useEffect(() => {
    if (!enabled) {
      spokenId.current = lastAssistant?.id ?? spokenId.current
      stop()
    }
  }, [enabled, lastAssistant?.id, stop])

  useEffect(() => {
    if (!active) stop()
  }, [active, stop])

  useEffect(() => {
    if (!enabled || !active || !lastAssistant || lastAssistant.id === spokenId.current) return
    spokenId.current = lastAssistant.id
    const text = toSpokenText(lastAssistant.content)
    if (!text) return
    const mine = ++run.current
    stopAgentSpeech()
    setStatus('loading')
    void (async () => {
      const speech = await requestAgentSpeech(text, lang === 'id' ? 'id' : 'en')
      if (run.current !== mine) return
      if (!speech.ok) {
        setStatus('error')
        return
      }
      setStatus('playing')
      try {
        await playAgentSpeech(speech.data)
        if (run.current === mine) setStatus('idle')
      } catch {
        if (run.current === mine) setStatus('error')
      }
    })()
  }, [enabled, active, lastAssistant, lang])

  useEffect(() => () => stopAgentSpeech(), [])

  return { enabled, status, toggle, stop }
}
