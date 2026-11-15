import { useCallback, useEffect, useState } from 'react'
import { fetchBackendObjectInfo, requestAgentSpeech, requestGuideReply, type ObjectInfo } from '../frontend/api'
import { useXRApp } from './store'
import { playAgentSpeech, stopAgentSpeech, unlockAgentSpeech } from './agentSpeech'

export type SpeechStatus = 'loading' | 'playing' | 'ready' | 'error' | 'unavailable'

/**
 * The agentic voice-over of one object: catalog record -> two-sentence summary from the Mission Liaison Agent ->
 * speech from /api/agent/voiceover/text, played once and replayable. Shared by the in-world 3D card and the
 * Explorer's 2D object card, so both show the same text and drive the same audio.
 */
export function useAgentNarration({
  objectId,
  objectName,
  objectType,
  contentReady,
  localDescription,
}: {
  objectId: string
  objectName: string
  objectType: string
  /** false while there is nothing to narrate (no object open, or its content is still loading) */
  contentReady: boolean
  localDescription: string
}) {
  const lang = useXRApp((state) => state.settings.lang)
  const [object, setObject] = useState<ObjectInfo | null>(null)
  const [catalogMessage, setCatalogMessage] = useState<string | null>(null)
  const [guideAnswer, setGuideAnswer] = useState<string | null>(null)
  const [guideError, setGuideError] = useState<string | null>(null)
  const [guideLoading, setGuideLoading] = useState(false)
  const [speechBlob, setSpeechBlob] = useState<Blob | null>(null)
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>('loading')
  const [speechError, setSpeechError] = useState<string | null>(null)
  const isIndonesian = lang === 'id'

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
    setSpeechStatus('loading')
    setSpeechError(null)
    stopAgentSpeech()

    const load = async () => {
      const result = await fetchBackendObjectInfo(objectId)
      if (!active) return

      let narrationText = localDescription
      if (result.ok) {
        setObject(result.data)
        setGuideLoading(true)

        const reply = await requestGuideReply({
          objectId,
          objectName: result.data.name,
          question: isIndonesian
            ? 'Berikan ringkasan dua kalimat maksimal 45 kata, hanya berdasarkan record katalog backend objek ini.'
            : 'Give a two-sentence summary of at most 45 words, based only on this object’s backend catalog record.',
          lang: isIndonesian ? 'id' : 'en',
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
              ? isIndonesian
                ? 'Tidak ada record katalog; menampilkan informasi objek tersimpan.'
                : 'No catalog record; showing bundled object details.'
              : isIndonesian
                ? 'Record katalog objek ini belum tersedia.'
                : 'No catalog record is available for this object.'
            : localDescription
              ? isIndonesian
                ? 'Katalog live tidak terhubung; menampilkan informasi tersimpan.'
                : 'Live catalog is unavailable; showing bundled object details.'
              : isIndonesian
                ? 'Layanan katalog tidak terhubung.'
                : 'Catalog service is unavailable.',
        )
      }

      if (!narrationText.trim()) {
        setSpeechStatus('unavailable')
        return
      }

      const speech = await requestAgentSpeech(narrationText, isIndonesian ? 'id' : 'en')
      if (!active) return
      if (!speech.ok) {
        setSpeechStatus('error')
        setSpeechError(speech.error)
        return
      }

      setSpeechBlob(speech.data)
      setSpeechStatus('playing')
      try {
        await playAgentSpeech(speech.data, controller.signal)
        if (active && !controller.signal.aborted) setSpeechStatus('ready')
      } catch (error: unknown) {
        if (active) {
          setSpeechStatus('ready')
          setSpeechError(error instanceof Error ? error.message : String(error))
        }
      }
    }

    const timer = window.setTimeout(() => void load(), 0)
    return () => {
      active = false
      controller.abort()
      window.clearTimeout(timer)
      stopAgentSpeech()
    }
  }, [contentReady, objectId, objectName, objectType, localDescription, lang, isIndonesian])

  const replay = useCallback(() => {
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
  }, [speechBlob])

  /** stops the voice; the clip stays ready to replay */
  const stop = useCallback(() => stopAgentSpeech(), [])

  return { object, catalogMessage, guideAnswer, guideError, guideLoading, speechStatus, speechError, canReplay: speechBlob !== null, replay, stop, isIndonesian }
}
