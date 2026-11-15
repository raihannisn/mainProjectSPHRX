import { Text } from '@react-three/drei'
import { FONT, FONT_BOLD } from './font'
import { GlassPanel, PopIn } from './ui3d'
import { useAgentNarration } from './useAgentNarration'

export function CatalogObjectCard3D({
  objectId,
  objectName,
  objectType,
  contentReady,
  localDescription,
  hidden = false,
}: {
  objectId: string
  objectName: string
  objectType: string
  contentReady: boolean
  localDescription: string
  /** keeps the summary + voice-over running but draws no panel (inline 2D viewer; its HUD card shows the text) */
  hidden?: boolean
}) {
  const { object, catalogMessage, guideAnswer, guideError, guideLoading, speechStatus, speechError, canReplay, replay, isIndonesian } =
    useAgentNarration({ objectId, objectName, objectType, contentReady, localDescription })

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

  return (
    <group visible={!hidden} position={[-1.62, 0.08, 0.12]} rotation={[0, 0.42, 0]}>
      <PopIn key={`${objectId}-${isIndonesian ? 'id' : 'en'}`}>
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
          onClick={canReplay ? replay : undefined}
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
