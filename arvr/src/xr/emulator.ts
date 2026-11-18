/**
 * No-headset testing: open a page with ?emulate (or ?emulate=1) to install a simulated Meta Quest 3 (IWER, by
 * Meta) with an on-screen panel to move the headset and controllers. It forces itself over the browser's own
 * navigator.xr, so it must never run on a real headset: there it would replace the real WebXR runtime with the
 * simulation and VR could not start. ?emulate=0 (or false / off / no) turns it off.
 */
const REAL_HEADSET_UA = /OculusBrowser|Quest|Pico|Wolvic|VR Headset/i
const requested = (() => {
  if (typeof location === 'undefined') return false
  const value = new URLSearchParams(location.search).get('emulate')
  return value !== null && !/^(0|false|off|no)$/i.test(value)
})()

/** The emulator was asked for and this is not a headset browser. (A PC-VR headset is checked at start-up.) */
export const EMULATE = requested && !(typeof navigator !== 'undefined' && REAL_HEADSET_UA.test(navigator.userAgent))

/** True when the browser itself already offers immersive VR: a real headset, so the simulation must stay off. */
export async function realHeadsetPresent(): Promise<boolean> {
  try {
    return (await navigator.xr?.isSessionSupported('immersive-vr')) === true
  } catch {
    return false
  }
}

export async function startEmulator(): Promise<void> {
  const [{ XRDevice, metaQuest3 }, { DevUI }] = await Promise.all([import('iwer'), import('@iwer/devui')])
  const device = new XRDevice(metaQuest3)
  device.installRuntime({ forceInstall: true })
  device.installDevUI(DevUI)
  ;(window as unknown as { __xrDevice: unknown }).__xrDevice = device
  // for automated tests (scripts/smoke-xr.mjs): read loading state and change scenes from outside
  const [{ useLoading }, { useXRApp }] = await Promise.all([import('./loading'), import('./store')])
  ;(window as unknown as { __xrTest: unknown }).__xrTest = { useLoading, useXRApp }
}
