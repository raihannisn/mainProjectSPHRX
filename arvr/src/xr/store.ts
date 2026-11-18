import { create } from 'zustand'
import type { GuideRequest, ViewMode } from './types'
import { detectTier, type QualitySetting, type Tier } from './quality'
import type { SpherexObservation } from '../frontend/api'

export function cacheObservations(obs: SpherexObservation[]) {
  try {
    const existing = JSON.parse(sessionStorage.getItem('spherex_obs_cache') || '{}')
    for (const o of obs) {
      existing[o.observation_id] = o
    }
    sessionStorage.setItem('spherex_obs_cache', JSON.stringify(existing))
  } catch {
    /* private mode / quota exceeded */
  }
}

export function getCachedObservation(id: string): SpherexObservation | null {
  try {
    const existing = JSON.parse(sessionStorage.getItem('spherex_obs_cache') || '{}')
    return existing[id] || null
  } catch {
    return null
  }
}

/** User settings from the wrist menu (VR/AR) and the on-screen ⚙ menu. */
export interface XRSettings {
  /** label opacity 0..1 (0 hides labels) */
  labels: number
  /** show hotspot pins / surface beacons */
  pins: boolean
  /** tone-mapping exposure (brightness) */
  exposure: number
  /** Mars surface haze multiplier */
  haze: number
  /** movement speed multiplier */
  moveSpeed: number
  /** VR turning: snap degrees, or smooth */
  turn: 'snap30' | 'snap45' | 'smooth'
  /** show the fps meter */
  showFps: boolean
  /** graphics quality: auto or a fixed tier */
  quality: QualitySetting
  /** Mars surface time of day: 0 sunrise … 0.5 noon … 1 sunset */
  timeOfDay: number
  /** ambience + UI sounds (off by default: judging rooms vary) */
  sound: boolean
  /** soundtrack volume 0..1 */
  musicVolume: number
  /** effects + ambience volume 0..1 */
  sfxVolume: number
  /** VR comfort vignette while moving with the stick */
  vignette: boolean
  /** seated play: raises your viewpoint by 0.5 m in VR */
  seated: boolean
  /** VR movement on the surface: teleport (most comfortable, default) or smooth stick walking */
  locomotion: 'teleport' | 'smooth'
  /** extra height in metres (VR), e.g. for short users or children */
  heightOffset: number
  /** read the guided tour aloud (only while Sound is on) */
  narration: boolean
  /** Interface and info-pin language. The application is English-only. */
  lang: 'en' | 'id'
}

export const DEFAULT_SETTINGS: XRSettings = { labels: 1, pins: true, exposure: 1, haze: 1, moveSpeed: 1, turn: 'snap30', showFps: false, quality: 'auto', timeOfDay: 0.38, sound: false, musicVolume: 0.6, sfxVolume: 0.8, vignette: true, seated: false, locomotion: 'teleport', heightOffset: 0, narration: true, lang: 'en' }

/**
 * Shared app state for the XR module. The web viewer can read/write the same store
 * (selected body, band, observation) or deep-link via /xr/body/:id?band=…&obs=…
 */
export interface XRAppState {
  /** null = Solar System hub */
  bodyId: string | null
  /** Surface site being stood on (content/sites/<id>.json); bodyId is then that site's body. */
  siteId: string | null
  /** Selected celestial target (e.g. 'rcw-36') */
  target: string | null
  /** Spectral band selected in the web viewer (e.g. a SPHEREx band); passed through for now. */
  band: string | null
  /** Observation / source-image id selected in the web viewer; passed through for now. */
  observation: string | null
  /** Second observation id for comparison. */
  observationB: string | null
  /** Resolved scientific metadata for Observation A. */
  observationDataA: SpherexObservation | null
  /** Resolved scientific metadata for Observation B. */
  observationDataB: SpherexObservation | null

  hotspotId: string | null
  hoveredId: string | null
  mode: ViewMode
  gyroEnabled: boolean
  /** Camera AR: the phone's camera feed behind the scene, no WebXR/ARCore needed (works on any device). */
  cameraAr: boolean
  arAnchor: [number, number, number] | null
  /** AR (camera or passthrough): the model is pinned in one place; false = it floats in front of where you aim */
  arLocked: boolean
  /** Camera AR: the assumed surface under the phone (a table is closer than the floor) */
  arSurface: 'table' | 'floor'
  /** bumped by "Reset": the model comes back in front of you and the phone's compass is re-centred */
  arResetNonce: number
  /** True when an asteroid is shown as the procedural placeholder instead of a real shape model. */
  shapeIsIllustration: boolean
  lastGuideRequest: GuideRequest | null
  toast: string | null
  /** Surface mode: request to move the player to a point (consumed by the player controller). */
  goTo: { x: number; z: number; exact?: boolean } | null
  /** Surface mode: yaw (rad) added to phone-gyro heading so the start view faces the scene. */
  headingOffset: number
  settings: XRSettings
  menuOpen: boolean
  /** guided tour: current stop (TOUR.length = the closing card), or null when no tour is running */
  tourStep: number | null
  tourPaused: boolean
  setTourStep: (n: number | null) => void
  /** selected NASA image layer per body (e.g. mars: 'elevation') */
  layer: Record<string, string>
  setLayer: (body: string, layer: string) => void
  /** what "View in my room" shows: the current scene as a tabletop model, or a life-size rover */
  arModel: 'scene' | 'rover'
  setArModel: (m: 'scene' | 'rover') => void
  /** bumped by "Re-centre view": the VR origin turns you to face the scene again */
  recenter: number
  requestRecenter: () => void
  /** tier chosen by auto quality (device detection, then lowered by the frame-rate governor) */
  autoTier: Tier
  /** completed mission goals (saved on this device) */
  goalsDone: Record<string, true>
  /** mission card currently shown (scene intro or a just-completed goal) */
  missionCard: { mission: string; goal: string; hint: string; done: boolean; progress: string } | null
  completeGoal: (id: string) => void
  resetMissions: () => void
  setMissionCard: (c: XRAppState['missionCard']) => void

  selectBody: (id: string | null) => void
  setTarget: (target: string | null) => void
  setBand: (band: string | null) => void
  setObservation: (obs: string | null) => void
  setObservationB: (obs: string | null) => void
  setObservationData: (a: SpherexObservation | null, b?: SpherexObservation | null) => void
  clearObservations: () => void
  selectSite: (id: string, body: string) => void
  selectHotspot: (id: string | null) => void
  requestGoTo: (p: { x: number; z: number; exact?: boolean } | null) => void
  setSetting: <K extends keyof XRSettings>(key: K, value: XRSettings[K]) => void
  setMenuOpen: (open: boolean) => void
  setHovered: (id: string | null) => void
  setMode: (mode: ViewMode) => void
  setGyroEnabled: (on: boolean) => void
  setCameraAr: (on: boolean) => void
  setArLocked: (locked: boolean) => void
  setArSurface: (surface: 'table' | 'floor') => void
  resetAr: () => void
  setArAnchor: (p: [number, number, number] | null) => void
  setLastGuideRequest: (r: GuideRequest) => void
  showToast: (msg: string | null, ms?: number) => void
  /** AR session without hit-testing (some phones): models are placed in front of you instead */
  arNoHitTest: boolean
}

const SETTINGS_KEY = 'cosmic-xr-settings'
const GOALS_KEY = 'cosmic-xr-goals'
function loadJSON<T>(key: string, fallback: T): T {
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(key) ?? '{}') }
  } catch {
    return fallback
  }
}
function saveJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private mode etc. */
  }
}
function loadSettings(): XRSettings {
  try {
    return {
      ...DEFAULT_SETTINGS,
      ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}'),
      lang: 'en',
    }
  } catch {
    return { ...DEFAULT_SETTINGS, lang: 'en' }
  }
}

let toastTimer: ReturnType<typeof setTimeout> | undefined

export const useXRApp = create<XRAppState>((set) => ({
  bodyId: null,
  siteId: null,
  goTo: null,
  headingOffset: 0,
  settings: loadSettings(),
  menuOpen: false,
  tourStep: null,
  tourPaused: false,
  setTourStep: (tourStep) => set({ tourStep, tourPaused: false }),
  recenter: 0,
  arModel: 'scene',
  layer: {},
  setLayer: (body, layer) => set((s) => ({ layer: { ...s.layer, [body]: layer } })),
  setArModel: (arModel) => set({ arModel, arAnchor: null }),
  requestRecenter: () => set((s) => ({ recenter: s.recenter + 1 })),
  autoTier: detectTier(),
  goalsDone: loadJSON(GOALS_KEY, {}),
  missionCard: null,
  completeGoal: (id) =>
    set((s) => {
      if (s.goalsDone[id]) return s
      const goalsDone = { ...s.goalsDone, [id]: true as const }
      saveJSON(GOALS_KEY, goalsDone)
      return { goalsDone }
    }),
  resetMissions: () => {
    saveJSON(GOALS_KEY, {})
    set({ goalsDone: {} })
  },
  setMissionCard: (missionCard) => set({ missionCard }),
  target: null,
  band: null,
  observation: null,
  observationB: null,
  observationDataA: null,
  observationDataB: null,
  hotspotId: null,
  hoveredId: null,
  mode: 'desktop',
  gyroEnabled: false,
  cameraAr: false,
  arAnchor: null,
  arLocked: false,
  arSurface: 'table',
  arResetNonce: 0,
  shapeIsIllustration: false,
  lastGuideRequest: null,
  toast: null,

  selectBody: (id) =>
    set((s) =>
      // phone AR, model not placed yet: a tap puts the model down (see ArAnchor), it must not also open a planet
      (id !== null && s.cameraAr && s.gyroEnabled && !s.arLocked) || (s.bodyId === id && !s.siteId)
        ? s
        : { bodyId: id, siteId: null, hotspotId: null, hoveredId: null, shapeIsIllustration: false },
    ),
  selectSite: (id, body) => set((s) => (s.siteId === id ? s : { siteId: id, bodyId: body, hotspotId: null, hoveredId: null })),
  requestGoTo: (goTo) => set({ goTo }),
  setSetting: (key, value) =>
    set((s) => {
      const settings: XRSettings =
        key === 'lang'
          ? { ...s.settings, lang: 'en' }
          : { ...s.settings, [key]: value }
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
      } catch {
        /* private mode etc. */
      }
      return { settings }
    }),
  setMenuOpen: (menuOpen) => set({ menuOpen }),
  setTarget: (target) => set({ target }),
  setBand: (band) => set({ band }),
  setObservation: (observation) => set({ observation }),
  setObservationB: (observationB) => set({ observationB }),
  setObservationData: (observationDataA, observationDataB = null) => set({ observationDataA, observationDataB }),
  clearObservations: () =>
    set({
      observation: null,
      observationB: null,
      observationDataA: null,
      observationDataB: null,
    }),
  selectHotspot: (hotspotId) => set({ hotspotId }),
  setHovered: (hoveredId) => set({ hoveredId }),
  setMode: (mode) => set({ mode }),
  setGyroEnabled: (gyroEnabled) => set({ gyroEnabled }),
  setCameraAr: (cameraAr) => set({ cameraAr, arLocked: false }),
  setArLocked: (arLocked) => set({ arLocked }),
  setArSurface: (arSurface) => set({ arSurface }),
  resetAr: () => set((s) => ({ arLocked: false, arResetNonce: s.arResetNonce + 1 })),
  setArAnchor: (arAnchor) => set({ arAnchor }),
  setLastGuideRequest: (lastGuideRequest) => set({ lastGuideRequest }),
  showToast: (toast, ms = 3000) => {
    clearTimeout(toastTimer)
    set({ toast })
    if (toast) toastTimer = setTimeout(() => set({ toast: null }), ms)
  },
  arNoHitTest: false,
}))

// Debug handle in dev builds: window.__xrApp.getState()
if (import.meta.env.DEV) (window as unknown as { __xrApp: typeof useXRApp }).__xrApp = useXRApp
