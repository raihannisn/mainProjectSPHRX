import { useEffect, useState } from 'react'
import { Text } from '@react-three/drei'
import {
  fetchBackendObjectInfo,
  requestAgentSpeech,
  requestGuideReply,
  type ObjectInfo,
} from '../frontend/api'
import { useXRApp } from './store'
import { FONT, FONT_BOLD } from './font'
import { GlassPanel, PopIn } from './ui3d'
import { playAgentSpeech, stopAgentSpeech, unlockAgentSpeech } from './agentSpeech'

type SpeechStatus = 'loading' | 'playing' | 'ready' | 'error' | 'unavailable'

export function CatalogObjectCard3D({
  objectId,
  objectName,
  objectType,
  contentReady,
  localDescription,
}: {
  objectId: string
  objectName: string
  objectType: string
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

  const description = localDescription || object?.description
  const guideText = guideLoading
    ? isIndonesian
      ? 'Cosmic Guide sedang menyiapkan ringkasan…'
      : 'Cosmic Guide is preparing a summary…'
    : guideAnswer ??
      (guideError
        ? `${isIndonesian ? 'Cosmic Guide tidak tersedia' : 'Cosmic Guide unavailable'}: ${guideError}`
        : catalogMessage
          ? isIndonesian
            ? 'Ringkasan AI memerlukan koneksi backend.'
            : 'AI summary requires a backend connection.'
          : isIndonesian
            ? 'Ringkasan AI belum tersedia.'
            : 'AI summary is not available.')
  const speechLabel =
    speechStatus === 'loading'
      ? isIndonesian
        ? 'MENYIAPKAN SUARA AI…'
        : 'PREPARING AI VOICE…'
      : speechStatus === 'playing'
        ? isIndonesian
          ? 'SUARA AI SEDANG DIPUTAR'
          : 'AI VOICE PLAYING'
        : speechStatus === 'ready'
          ? isIndonesian
            ? '▶ PUTAR ULANG SUARA AI'
            : '▶ REPLAY AI VOICE'
          : speechStatus === 'error'
            ? isIndonesian
              ? 'SUARA AI TIDAK TERSEDIA'
              : 'AI VOICE UNAVAILABLE'
            : isIndonesian
              ? 'DESKRIPSI SUARA BELUM TERSEDIA'
              : 'NO NARRATION AVAILABLE'

  const replaySpeech = () => {
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
  }

  return (
    <group position={[-1.62, 0.08, 0.12]} rotation={[0, 0.42, 0]}>
      <PopIn key={`${objectId}-${lang}`}>
        <GlassPanel width={1.58} height={2.14} radius={0.08} rim={0.01} />
        <Text
          font={FONT_BOLD}
          position={[-0.7, 0.91, 0]}
          fontSize={0.078}
          maxWidth={1.4}
          color="#ffffff"
          anchorX="left"
          anchorY="top"
        >
          {object?.name ?? objectName}
        </Text>
        <Text
          font={FONT}
          position={[-0.7, 0.69, 0]}
          fontSize={0.04}
          maxWidth={1.4}
          color="#4fe3d6"
          anchorX="left"
          anchorY="top"
        >
          {object?.type ?? objectType}
        </Text>
        <Text
          font={FONT}
          position={[-0.7, 0.53, 0]}
          fontSize={0.045}
          maxWidth={1.4}
          lineHeight={1.2}
          color="#d7def0"
          anchorX="left"
          anchorY="top"
        >
          {description ?? (isIndonesian ? 'Deskripsi belum tersedia.' : 'Description is not available yet.')}
        </Text>
        {catalogMessage && (
          <Text
            font={FONT}
            position={[-0.7, 0.22, 0]}
            fontSize={0.03}
            maxWidth={1.4}
            color={localDescription ? '#cbd5e1' : '#fbbf24'}
            anchorX="left"
            anchorY="top"
          >
            {catalogMessage}
          </Text>
        )}
        <Text
          font={FONT_BOLD}
          position={[-0.7, catalogMessage ? 0.08 : 0.2, 0]}
          fontSize={0.04}
          color="#4fe3d6"
          anchorX="left"
          anchorY="top"
        >
          COSMIC GUIDE
        </Text>
        <Text
          font={FONT}
          position={[-0.7, catalogMessage ? -0.06 : 0.06, 0]}
          fontSize={0.04}
          maxWidth={1.4}
          lineHeight={1.2}
          color={guideError ? '#cbd5e1' : '#d7def0'}
          anchorX="left"
          anchorY="top"
        >
          {guideText}
        </Text>
        <Text
          font={FONT_BOLD}
          position={[-0.7, -0.89, 0]}
          fontSize={0.033}
          maxWidth={1.4}
          color={speechStatus === 'error' ? '#fbbf24' : '#4fe3d6'}
          anchorX="left"
          anchorY="top"
          onClick={speechBlob ? replaySpeech : undefined}
        >
          {speechLabel}
        </Text>
        {speechError && (
          <Text
            font={FONT}
            position={[-0.7, -1.0, 0]}
            fontSize={0.027}
            maxWidth={1.4}
            color="#fbbf24"
            anchorX="left"
            anchorY="top"
          >
            {speechError}
          </Text>
        )}
      </PopIn>
    </group>
  )
}
