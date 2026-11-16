import { useCallback, useEffect, useRef, useState } from 'react'
import { requestAgentSpeech } from '../api'
import { playAgentSpeech, stopAgentSpeech, unlockAgentSpeech } from '../../xr/agentSpeech'
import { stopBrowserVoice } from '../../xr/browserVoice'
import type { ChatMessage } from './guideStore'

const STORAGE_KEY = 'cosmic-guide-voice'
/** keep a spoken answer short enough for one voice-over request */
const MAX_SPOKEN_CHARS = 500

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
  return text.length > MAX_SPOKEN_CHARS
    ? `${text.slice(0, MAX_SPOKEN_CHARS - 1).replace(/\s+\S*$/, '')}…`
    : text
}

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

/**
 * Voice for the Cosmic Guide window: while the toggle is on, each new answer from the agent is read aloud through
 * the same agentic voice-over as the object card (/api/agent/voiceover/text). On by default; the choice is remembered.
 */
export function useGuideSpeech(messages: ChatMessage[], active: boolean) {
  const [enabled, setEnabled] = useState(readStored)
  const [status, setStatus] = useState<GuideVoiceStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const last = messages[messages.length - 1]
  const lastAssistant = last?.role === 'assistant' ? last : null
  // an answer that is already on screen when the window mounts is not read back
  const spokenId = useRef<string | null>(lastAssistant?.id ?? null)
  const run = useRef(0)
  /** set by a spoken question: its answer is read aloud even while the toggle is off */
  const speakNextOnce = useRef(false)

  const stop = useCallback(() => {
    run.current++
    stopAgentSpeech()
    stopBrowserVoice()
    setStatus('idle')
    setError(null)
  }, [])

  const unlock = useCallback(() => {
    unlockAgentSpeech()
  }, [])

  const speakNext = useCallback(() => {
    speakNextOnce.current = true
    unlockAgentSpeech()
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
    if (!enabled) stop()
  }, [enabled, stop])

  useEffect(() => {
    if (!active) stop()
  }, [active, stop])

  useEffect(() => {
    if (!active || !lastAssistant || lastAssistant.id === spokenId.current) return
    spokenId.current = lastAssistant.id
    const wanted = enabled || speakNextOnce.current
    speakNextOnce.current = false
    if (!wanted) return
    const text = toSpokenText(lastAssistant.content)
    if (!text) return
    const mine = ++run.current
    stopAgentSpeech()
    stopBrowserVoice()
    setStatus('loading')
    setError(null)
    void (async () => {
      const speech = await requestAgentSpeech(text)
      if (run.current !== mine) return
      try {
        if (!speech.ok) throw new Error(speech.error)
        setStatus('playing')
        await playAgentSpeech(speech.data)
        if (run.current === mine) setStatus('idle')
      } catch (speechError: unknown) {
        if (run.current === mine) {
          setStatus('error')
          setError(speechError instanceof Error ? speechError.message : String(speechError))
        }
      }
    })()
  }, [enabled, active, lastAssistant])

  useEffect(
    () => () => {
      stopAgentSpeech()
      stopBrowserVoice()
    },
    [],
  )

  return { enabled, status, error, toggle, stop, unlock, speakNext }
}
