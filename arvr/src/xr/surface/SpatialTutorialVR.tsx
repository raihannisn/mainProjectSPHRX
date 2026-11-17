import { useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { useXRInputSourceState } from '@react-three/xr'
import { Vector3, type Group } from 'three'
import { GlassPanel, Button, UI } from '../ui3d'
import { FONT, FONT_BOLD } from '../font'
import { t } from '../i18n'

/**
 * Spatial Popup Tutorial (VR Startup)
 * Explains dual locomotion (walking + teleport) dynamically tailored to active input
 * (XR Controllers vs Bare Hand Tracking).
 * Dismissible via controller ray click or direct finger poke/pinch.
 */
export function SpatialTutorialVR({ onDismiss }: { onDismiss?: () => void }) {
  const [dismissed, setDismissed] = useState(false)
  const defaultCamera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)

  const groupRef = useRef<Group>(null)
  const headPos = useMemo(() => new Vector3(), [])
  const headDir = useMemo(() => new Vector3(), [])
  const targetPos = useMemo(() => new Vector3(), [])
  const initialized = useRef(false)

  // Detect active XR inputs
  const rightController = useXRInputSourceState('controller', 'right')
  const leftController = useXRInputSourceState('controller', 'left')
  const rightHand = useXRInputSourceState('hand', 'right')
  const leftHand = useXRInputSourceState('hand', 'left')

  const hasControllers = Boolean(rightController || leftController)
  const hasHands = Boolean(rightHand || leftHand)
  const isHandMode = !hasControllers && hasHands

  useFrame((_, dt) => {
    const g = groupRef.current
    if (!g || dismissed) return

    // Position panel 1.25m in front of VR head gaze, stabilized
    const cam = defaultCamera
    cam.getWorldPosition(headPos)
    cam.getWorldDirection(headDir)
    headDir.y = 0
    headDir.normalize()

    targetPos.copy(headPos).addScaledVector(headDir, 1.25)
    targetPos.y = headPos.y - 0.05

    if (!initialized.current) {
      g.position.copy(targetPos)
      g.lookAt(headPos.x, targetPos.y, headPos.z)
      initialized.current = true
    } else {
      g.position.lerp(targetPos, 1 - Math.exp(-dt * 3.5))
      g.lookAt(headPos.x, g.position.y, headPos.z)
    }
  })

  if (dismissed) return null

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.()
  }

  const width = 1.6
  const height = 0.96

  return (
    <group ref={groupRef} renderOrder={3000}>
      <GlassPanel width={width} height={height} radius={0.08} rim={0.008} />

      {/* Header Badge */}
      <Text
        font={FONT_BOLD}
        position={[0, height * 0.38, 0.01]}
        fontSize={0.045}
        color={UI.accent}
        letterSpacing={0.08}
        anchorX="center"
        anchorY="middle"
      >
        {t('SPHEREX EXPEDITION — VR LOCOMOTION')}
      </Text>

      {/* Dynamic Input Mode Badge */}
      <Text
        font={FONT}
        position={[0, height * 0.28, 0.01]}
        fontSize={0.032}
        color="#70a5ff"
        anchorX="center"
        anchorY="middle"
      >
        {isHandMode
          ? `✋ ${t('ACTIVE: BARE HAND TRACKING MODE')}`
          : `🎮 ${t('ACTIVE: DUAL VR CONTROLLERS')}`}
      </Text>

      {/* Main Guidance Text Block */}
      {isHandMode ? (
        <group position={[0, 0.04, 0.01]}>
          <Text
            font={FONT_BOLD}
            position={[-width * 0.44, 0.12, 0]}
            fontSize={0.033}
            color="#ffffff"
            anchorX="left"
            anchorY="middle"
          >
            {`• ${t('Left Hand')}:`}
          </Text>
          <Text
            font={FONT}
            position={[-width * 0.15, 0.12, 0]}
            fontSize={0.03}
            color="#e2e8f0"
            anchorX="left"
            anchorY="middle"
            maxWidth={width * 0.58}
          >
            {t('Pinch & drag or hold pinch to cruise/walk forward smoothly.')}
          </Text>

          <Text
            font={FONT_BOLD}
            position={[-width * 0.44, 0.01, 0]}
            fontSize={0.033}
            color="#ffffff"
            anchorX="left"
            anchorY="middle"
          >
            {`• ${t('Right Hand')}:`}
          </Text>
          <Text
            font={FONT}
            position={[-width * 0.15, 0.01, 0]}
            fontSize={0.03}
            color="#e2e8f0"
            anchorX="left"
            anchorY="middle"
            maxWidth={width * 0.58}
          >
            {t('Point to aim teleport arc; pinch index & thumb to instant jump/teleport.')}
          </Text>

          <Text
            font={FONT_BOLD}
            position={[-width * 0.44, -0.1, 0]}
            fontSize={0.033}
            color="#ffffff"
            anchorX="left"
            anchorY="middle"
          >
            {`• ${t('Interactions')}:`}
          </Text>
          <Text
            font={FONT}
            position={[-width * 0.15, -0.1, 0]}
            fontSize={0.03}
            color="#e2e8f0"
            anchorX="left"
            anchorY="middle"
            maxWidth={width * 0.58}
          >
            {t('Direct finger-poke 3D buttons or pinch to grab and throw rocks.')}
          </Text>
        </group>
      ) : (
        <group position={[0, 0.04, 0.01]}>
          <Text
            font={FONT_BOLD}
            position={[-width * 0.44, 0.12, 0]}
            fontSize={0.033}
            color="#ffffff"
            anchorX="left"
            anchorY="middle"
          >
            {`• ${t('Left Stick')}:`}
          </Text>
          <Text
            font={FONT}
            position={[-width * 0.15, 0.12, 0]}
            fontSize={0.03}
            color="#e2e8f0"
            anchorX="left"
            anchorY="middle"
            maxWidth={width * 0.58}
          >
            {t('Smooth walking in all directions (click to toggle sprint).')}
          </Text>

          <Text
            font={FONT_BOLD}
            position={[-width * 0.44, 0.01, 0]}
            fontSize={0.033}
            color="#ffffff"
            anchorX="left"
            anchorY="middle"
          >
            {`• ${t('Right Stick')}:`}
          </Text>
          <Text
            font={FONT}
            position={[-width * 0.15, 0.01, 0]}
            fontSize={0.03}
            color="#e2e8f0"
            anchorX="left"
            anchorY="middle"
            maxWidth={width * 0.58}
          >
            {t('Snap-turn (left/right) + push forward to trigger parabolic teleport arc.')}
          </Text>

          <Text
            font={FONT_BOLD}
            position={[-width * 0.44, -0.1, 0]}
            fontSize={0.033}
            color="#ffffff"
            anchorX="left"
            anchorY="middle"
          >
            {`• ${t('Buttons & Grip')}:`}
          </Text>
          <Text
            font={FONT}
            position={[-width * 0.15, -0.1, 0]}
            fontSize={0.03}
            color="#e2e8f0"
            anchorX="left"
            anchorY="middle"
            maxWidth={width * 0.58}
          >
            {t('Grip to grab rocks; A/X to perform low-gravity Mars hop (0.38g).')}
          </Text>
        </group>
      )}

      {/* Dismiss Button (Supports raycast click or direct finger poke) */}
      <Button
        position={[0, -height * 0.34, 0.02]}
        width={0.7}
        height={0.16}
        tone="accent"
        label={t('START EXPLORING 🚀')}
        onPress={handleDismiss}
      />
    </group>
  )
}
