import { useEffect, useRef } from 'react'

/** The rear camera, full size behind a transparent 3D canvas. Stops the camera when it unmounts. */
export function CameraFeed({ onError }: { onError?: (message: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const report = useRef(onError)
  report.current = onError

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false
    if (!navigator.mediaDevices?.getUserMedia) {
      report.current?.('The camera needs a secure link (https://). Showing the model without it.')
      return
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((track) => track.stop())
          return
        }
        stream = s
        const el = video.current
        if (!el) return
        el.srcObject = s
        el.play().catch(() => undefined)
      })
      .catch(() => report.current?.('Camera access was blocked. Allow the camera for this site to see the model in your room.'))
    return () => {
      cancelled = true
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  return <video className="xr-camera-feed" ref={video} playsInline muted autoPlay aria-hidden />
}
