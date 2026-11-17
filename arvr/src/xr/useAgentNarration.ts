import { useCallback, useEffect, useState } from 'react'
import { fetchBackendObjectInfo, requestAgentSpeech, requestGuideReply, type ObjectInfo } from '../frontend/api'
import { playAgentSpeech, stopAgentSpeech, unlockAgentSpeech } from './agentSpeech'
import { speakWithBrowser, stopBrowserVoice } from './browserVoice'

export type SpeechStatus = 'loading' | 'playing' | 'ready' | 'error' | 'unavailable'
type SpeechEngine = 'agent' | 'browser' | null

/**
 * The agentic voice-over of one object: catalog record -> two-sentence summary from the Mission Liaison Agent ->
 * speech from /api/agent/voiceover/text, with a browser-speech fallback when generated audio is unavailable.
 * Shared by the in-world 3D card and the Explorer's 2D object card.
 */
export function useAgentNarration({
  objectId,
  objectName,
  objectType,
  contentReady,
  localDescription,
  narrationDescription = localDescription,
}: {
  objectId: string
  objectName: string
  objectType: string
  /** false while there is nothing to narrate (no object open, or its content is still loading) */
  contentReady: boolean
  localDescription: string
  narrationDescription?: string
}) {
  const [object, setObject] = useState<ObjectInfo | null>(null)
  const [catalogMessage, setCatalogMessage] = useState<string | null>(null)
  const [guideAnswer, setGuideAnswer] = useState<string | null>(null)
  const [guideError, setGuideError] = useState<string | null>(null)
  const [guideLoading, setGuideLoading] = useState(false)
  const [speechBlob, setSpeechBlob] = useState<Blob | null>(null)
  const [speechText, setSpeechText] = useState('')
  const [speechEngine, setSpeechEngine] = useState<SpeechEngine>(null)
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>('loading')
  const [speechError, setSpeechError] = useState<string | null>(null)
  useEffect(() => {
    if (!contentReady) return
    let active = true
    const controller = new AbortController()
    setObject(null)
    setCatalogMessage(null)
    setGuideAnswer(null)
    setGuideError(null)
    setGuideLoading(false)
    setSpeechBlob(null)
    setSpeechText('')
    setSpeechEngine(null)
    setSpeechStatus('loading')
    setSpeechError(null)
    stopAgentSpeech()
    stopBrowserVoice()

    const load = async () => {
      const result = await fetchBackendObjectInfo(objectId)
      if (!active) return

      let narrationText = narrationDescription
      if (result.ok) {
        setObject(result.data)
        setGuideLoading(true)

        const reply = await requestGuideReply({
          objectId,
          objectName: result.data.name,
          question: 'Give a two-sentence summary of at most 45 words, based only on this object’s backend catalog record.',
          lang: 'en',
          timeoutMs: 15000,
        })
        if (!active) return
        setGuideLoading(false)
        if (reply.ok) {
          setGuideAnswer(reply.text)
          narrationText = reply.text
        } else {
          setGuideError(reply.error)
          narrationText ||= result.data.description
        }
      } else {
        const isMissing = result.error.includes('HTTP 404')
        setCatalogMessage(
          isMissing
            ? localDescription
              ? 'No catalog record; showing bundled object details.'
              : 'No catalog record is available for this object.'
            : localDescription
              ? 'Live catalog is unavailable; showing bundled object details.'
              : 'Catalog service is unavailable.',
        )
      }

      if (!narrationText.trim()) {
        setSpeechStatus('unavailable')
        return
      }

      const fallBackToBrowserVoice = async (_reason?: string) => {
        setSpeechBlob(null)
        setSpeechText(narrationText)
        setSpeechEngine('browser')
        setSpeechStatus('playing')
        setSpeechError(null)
        try {
          await speakWithBrowser(narrationText)
          if (active && !controller.signal.aborted) setSpeechStatus('ready')
        } catch (error: unknown) {
          if (active && !controller.signal.aborted) {
            setSpeechStatus('error')
            setSpeechError('Voice playback is unavailable on this device.')
          }
        }
      }

      const speech = await requestAgentSpeech(narrationText)
      if (!active) return
      if (!speech.ok) {
        await fallBackToBrowserVoice(speech.error)
        return
      }

      setSpeechBlob(speech.data)
      setSpeechText(narrationText)
      setSpeechEngine('agent')
      setSpeechStatus('playing')
      try {
        await playAgentSpeech(speech.data, controller.signal)
        if (active && !controller.signal.aborted) setSpeechStatus('ready')
      } catch (error: unknown) {
        if (active && !controller.signal.aborted) {
          await fallBackToBrowserVoice(error instanceof Error ? error.message : String(error))
        }
      }
    }

    const timer = window.setTimeout(() => void load(), 0)
    return () => {
      active = false
      controller.abort()
      window.clearTimeout(timer)
      stopAgentSpeech()
      stopBrowserVoice()
    }
  }, [contentReady, objectId, objectName, objectType, narrationDescription])

  const replay = useCallback(() => {
    if (speechEngine === 'browser') {
      if (!speechText) return
      setSpeechStatus('playing')
      void speakWithBrowser(speechText).then(
        () => setSpeechStatus('ready'),
        (error: unknown) => {
          setSpeechStatus('error')
          setSpeechError(error instanceof Error ? error.message : String(error))
        },
      )
      return
    }
    if (!speechBlob) return
    unlockAgentSpeech()
    setSpeechStatus('playing')
    setSpeechError(null)
    void playAgentSpeech(speechBlob).then(
      () => setSpeechStatus('ready'),
      (error: unknown) => {
        setSpeechStatus('error')
        setSpeechError(error instanceof Error ? error.message : String(error))
      },
    )
  }, [speechBlob, speechEngine, speechText])

  /** stops the voice; the clip stays ready to replay */
  const stop = useCallback(() => {
    stopAgentSpeech()
    stopBrowserVoice()
    setSpeechStatus((status) => (status === 'playing' ? 'ready' : status))
  }, [])

  return {
    object,
    catalogMessage,
    guideAnswer,
    guideError,
    guideLoading,
    speechStatus,
    speechError,
    canReplay: speechBlob !== null || (speechEngine === 'browser' && speechText.length > 0),
    engine: speechEngine,
    replay,
    stop,
  }
}
