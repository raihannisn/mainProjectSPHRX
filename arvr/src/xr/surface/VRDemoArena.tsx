import { useMemo, useRef } from 'react'
import { Text } from '@react-three/drei'
import { MeshStandardMaterial, CylinderGeometry, Vector3, type Group } from 'three'
import { FONT, FONT_BOLD } from '../font'
import { t } from '../i18n'
import type { HeightField } from './terrain'

/**
 * VR Demo Scene / Calibration Arena
 * Provides a 10m x 10m holographic calibration grid at spawn with 1m increments,
 * plus interactive observation pedestals for testing walking, teleporting, and spatial grabbing
 * in both full VR and Passthrough XR modes.
 */
export function VRDemoArena({ spawn, hf }: { spawn: { x: number; z: number }; hf: HeightField }) {
  const groundY = useMemo(() => hf.heightAt(spawn.x, spawn.z), [hf, spawn])
  const arenaRef = useRef<Group>(null)

  // Pedestal positions around spawn
  const pedestals = useMemo(
    () => [
      { x: spawn.x + 2.5, z: spawn.z - 2.0, label: 'SAMPLE ALPHA (BASALT)' },
      { x: spawn.x - 2.5, z: spawn.z - 2.0, label: 'SAMPLE BETA (HEMATITE)' },
      { x: spawn.x, z: spawn.z + 3.2, label: 'TELEPORT TARGET ZONE' },
    ],
    [spawn]
  )

  return (
    <group ref={arenaRef} position={[spawn.x, groundY + 0.04, spawn.z]}>
      {/* 10m x 10m Sci-fi Calibration Grid */}
      <gridHelper
        args={[10, 10, '#00e5ff', '#005b88']}
        position={[0, 0.02, 0]}
      />

      {/* Subtle Glowing Outer Perimeter Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <ringGeometry args={[4.9, 5.0, 64]} />
        <meshBasicMaterial color="#00e5ff" transparent opacity={0.5} toneMapped={false} />
      </mesh>

      {/* Arena Origin Marker */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <ringGeometry args={[0.3, 0.35, 32]} />
        <meshBasicMaterial color="#ffd15c" transparent opacity={0.8} toneMapped={false} />
      </mesh>

      {/* Floating Spatial Boundary Labels */}
      <Text
        font={FONT_BOLD}
        position={[0, 0.03, -5.2]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.24}
        color="#00e5ff"
        anchorX="center"
        anchorY="middle"
      >
        {`[ ${t('CALIBRATION ARENA - 10M GRID')} ]`}
      </Text>

      {/* Calibration Pedestals for Physical Inspection / Teleport Target */}
      {pedestals.map((p, idx) => {
        const pedY = hf.heightAt(p.x, p.z) - groundY
        return (
          <group key={idx} position={[p.x - spawn.x, pedY, p.z - spawn.z]}>
            {/* Pedestal Cylinder */}
            <mesh position={[0, 0.45, 0]}>
              <cylinderGeometry args={[0.38, 0.44, 0.9, 24]} />
              <meshStandardMaterial
                color="#1b2438"
                metalness={0.8}
                roughness={0.25}
                emissive="#00e5ff"
                emissiveIntensity={0.15}
              />
            </mesh>

            {/* Glowing Holo Platform Ring */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.91, 0]}>
              <ringGeometry args={[0.32, 0.37, 32]} />
              <meshBasicMaterial color="#00e5ff" toneMapped={false} />
            </mesh>

            {/* Interactive Target Sphere / Specimen */}
            <mesh position={[0, 1.12, 0]}>
              <sphereGeometry args={[0.14, 20, 20]} />
              <meshStandardMaterial
                color={idx === 2 ? '#ffaa00' : '#d85a38'}
                roughness={0.4}
                metalness={0.3}
              />
            </mesh>

            {/* Hovering 3D Specimen Label */}
            <Text
              font={FONT}
              position={[0, 1.45, 0]}
              fontSize={0.1}
              color="#ffffff"
              outlineWidth={0.008}
              outlineColor="#000000"
              anchorX="center"
              anchorY="middle"
            >
              {p.label}
            </Text>
          </group>
        )
      })}
    </group>
  )
}
