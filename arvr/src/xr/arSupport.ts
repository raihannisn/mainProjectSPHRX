/**
 * Where AR can (and cannot) run. Android Chrome uses WebXR; iPhone/iPad Safari has no WebXR at all, so
 * it gets AR Quick Look (a .usdz model opened by iOS itself) for the bodies listed here. Models are built
 * by scripts/build-usdz.mjs into public/ar/.
 */
const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent

/** iPhone, iPod, iPad (iPadOS reports itself as a Mac with a touch screen). */
export const IS_IOS =
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

export const IS_ANDROID = /Android/i.test(ua)

/** A browser embedded in another app (Instagram, Facebook, LINE, TikTok, WeChat…): no WebXR there. */
export const IS_IN_APP_BROWSER = /FBAN|FBAV|Instagram|Line\/|MicroMessenger|TikTok|Snapchat|; wv\)/i.test(ua)

/** Bodies that have a public/ar/<id>.usdz model. */
export const AR_QUICKLOOK_BODIES = ['mars', 'moon'] as const

/** Safari lists `ar` in <a>.relList when it can open Quick Look. */
export function supportsQuickLook(): boolean {
  if (typeof document === 'undefined') return false
  try {
    return document.createElement('a').relList?.supports?.('ar') === true
  } catch {
    return false
  }
}

/** Quick Look model for a body on this device, or null when the device or body has none. */
export function quickLookUrl(bodyId: string | null | undefined): string | null {
  if (!bodyId || !IS_IOS || !supportsQuickLook()) return null
  return (AR_QUICKLOOK_BODIES as readonly string[]).includes(bodyId) ? `/ar/${bodyId}.usdz` : null
}
