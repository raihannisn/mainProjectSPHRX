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
  narrationDescription,
  hidden = false,
}: {
  objectId: string
  objectName: string
  objectType: string
  contentReady: boolean
  localDescription: string
  narrationDescription?: string
  /** keeps the summary + voice-over running but draws no panel (inline 2D viewer; its HUD card shows the text) */
  hidden?: boolean
}) {
  const { object, catalogMessage, guideAnswer, guideError, guideLoading, speechStatus, speechError, engine, canReplay, replay } =
    useAgentNarration({ objectId, objectName, objectType, contentReady, localDescription, narrationDescription })

  const description = localDescription || object?.description
  const guideText = guideLoading
    ? 'Cosmic Guide is preparing a summary…'
    : guideAnswer ??
      (guideError
        ? `Cosmic Guide unavailable: ${guideError}`
        : catalogMessage
          ? 'AI summary requires a backend connection.'
          : 'AI summary is not available.')
  const speechLabel =
    speechStatus === 'loading'
      ? 'PREPARING AI VOICE…'
      : speechStatus === 'playing'
        ? engine === 'browser'
          ? 'BROWSER VOICE PLAYING'
          : 'AI VOICE PLAYING'
        : speechStatus === 'ready'
          ? engine === 'browser'
            ? '▶ REPLAY BROWSER VOICE'
            : '▶ REPLAY AI VOICE'
          : speechStatus === 'error'
            ? engine === 'browser'
              ? 'BROWSER VOICE UNAVAILABLE'
              : 'AI VOICE UNAVAILABLE'
            : 'NO NARRATION AVAILABLE'

  return (
    <group visible={!hidden} position={[-1.62, 0.08, 0.12]} rotation={[0, 0.42, 0]}>
      <PopIn key={objectId}>
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
          {description ?? 'Description is not available yet.'}
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
