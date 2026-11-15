import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * Lightweight background starfield using a single THREE.Points draw call.
 * Throttled to 30 FPS and capped at 1.5x pixel ratio for maximum performance across all devices.
 */
export function ComparisonStarfield() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let rafId = 0
    let lastTime = 0
    const frameInterval = 1000 / 30 // Max 30 FPS

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))

    const width = window.innerWidth
    const height = window.innerHeight
    renderer.setSize(width, height, false)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000)
    camera.position.z = 120

    // Create 350 particles in a single THREE.Points (1 draw call)
    const count = 350
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)

    const palette = [
      new THREE.Color('#4fe3d6'), // Neon Cyan
      new THREE.Color('#38bdf8'), // Sky Blue
      new THREE.Color('#f8fafc'), // Starlight White
      new THREE.Color('#ffd184'), // Gold Amber
      new THREE.Color('#818cf8'), // Soft Indigo
    ]

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 300
      positions[i * 3 + 1] = (Math.random() - 0.5) * 220
      positions[i * 3 + 2] = (Math.random() - 0.5) * 200

      const c = palette[i % palette.length]
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const material = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    const points = new THREE.Points(geometry, material)
    scene.add(points)

    const renderLoop = (time: number) => {
      rafId = requestAnimationFrame(renderLoop)
      if (time - lastTime >= frameInterval) {
        lastTime = time - ((time - lastTime) % frameInterval)
        points.rotation.y += 0.00035
        points.rotation.x += 0.00012
        renderer.render(scene, camera)
      }
    }
    rafId = requestAnimationFrame(renderLoop)

    const handleResize = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, false)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', handleResize)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fe-compare-starfield-canvas"
      aria-hidden="true"
    />
  )
}
