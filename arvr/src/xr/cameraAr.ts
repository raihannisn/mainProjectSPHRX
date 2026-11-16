import { requestGyroPermission } from './device'
import { useXRApp } from './store'

/**
 * Camera AR: the phone's rear camera behind the Explorer's 3D scene, steered by the motion sensors. Needs
 * no WebXR and no "Google Play Services for AR", so it works on any phone or tablet (iPhone included) and,
 * with a webcam and the mouse, on a laptop. It is what AR falls back to wherever real WebXR AR is missing.
 *
 * Call from a tap: iOS only shows its motion-permission prompt from a user gesture.
 * Returns false when a touch device refused motion access (the view then moves by dragging).
 */
export async function startCameraAr(): Promise<boolean> {
  const touch = navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches
  const motion = touch ? await requestGyroPermission() : false
  const s = useXRApp.getState()
  s.setCameraAr(true)
  s.setGyroEnabled(motion)
  return !touch || motion
}

export function stopCameraAr(): void {
  const s = useXRApp.getState()
  s.setCameraAr(false)
  s.setGyroEnabled(false)
}
