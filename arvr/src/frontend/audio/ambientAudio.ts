import { useSyncExternalStore } from 'react'

const AMBIENCE_KEY = 'spherex.ambient.music'
const DEFAULT_VOLUME = 0.28

class AmbientAudioManager {
  private audio: HTMLAudioElement | null = null
  private enabled: boolean = true
  private playing: boolean = false
  private listeners: Set<() => void> = new Set()
  private unlockListenerAttached: boolean = false

  constructor() {
    if (typeof window === 'undefined') return

    try {
      const stored = window.localStorage.getItem(AMBIENCE_KEY)
      // Default is enabled ('on'), unless explicitly stored as 'off'
      this.enabled = stored !== 'off'
    } catch {
      this.enabled = true
    }

    this.initAudio()
  }

  private initAudio() {
    if (typeof window === 'undefined') return
    try {
      const baseUrl = import.meta.env.BASE_URL || '/'
      const audioUrl = `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}audio/wormhole-ambience.mp3`
      this.audio = new Audio(audioUrl)
      this.audio.loop = true
      this.audio.volume = DEFAULT_VOLUME
      this.audio.preload = 'auto'

      this.audio.addEventListener('play', () => {
        this.playing = true
        this.notify()
      })
      this.audio.addEventListener('pause', () => {
        this.playing = false
        this.notify()
      })
      this.audio.addEventListener('ended', () => {
        this.playing = false
        this.notify()
      })

      // Try autoplaying right away if enabled
      if (this.enabled) {
        this.attemptAutoplay()
      }
    } catch (err) {
      console.warn('[AmbientAudio] Initialization error:', err)
    }
  }

  private attemptAutoplay() {
    if (!this.audio || !this.enabled) return
    const promise = this.audio.play()
    if (promise && typeof promise.then === 'function') {
      promise
        .then(() => {
          this.playing = true
          this.notify()
        })
        .catch(() => {
          // Autoplay blocked by browser policy; listen for first user gesture
          this.attachUnlockListener()
        })
    }
  }

  private attachUnlockListener() {
    if (this.unlockListenerAttached || typeof window === 'undefined') return
    this.unlockListenerAttached = true

    const unlock = () => {
      window.removeEventListener('pointerdown', unlock, true)
      window.removeEventListener('keydown', unlock, true)
      window.removeEventListener('touchstart', unlock, true)
      this.unlockListenerAttached = false

      if (this.enabled && this.audio && this.audio.paused) {
        this.audio.play().catch(() => {})
      }
    }

    window.addEventListener('pointerdown', unlock, true)
    window.addEventListener('keydown', unlock, true)
    window.addEventListener('touchstart', unlock, true)
  }

  public isEnabled(): boolean {
    return this.enabled
  }

  public isPlaying(): boolean {
    return this.playing
  }

  public setEnabled(enable: boolean) {
    this.enabled = enable
    try {
      window.localStorage.setItem(AMBIENCE_KEY, enable ? 'on' : 'off')
    } catch {}

    if (enable) {
      if (this.audio) {
        this.audio.play().catch(() => {
          this.attachUnlockListener()
        })
      }
    } else {
      if (this.audio) {
        this.audio.pause()
      }
    }
    this.notify()
  }

  public toggle(): boolean {
    this.setEnabled(!this.enabled)
    return this.enabled
  }

  public play() {
    if (!this.enabled) {
      this.setEnabled(true)
    } else if (this.audio && this.audio.paused) {
      this.audio.play().catch(() => {
        this.attachUnlockListener()
      })
    }
  }

  public pause() {
    if (this.audio && !this.audio.paused) {
      this.audio.pause()
    }
  }

  public subscribe = (callback: () => void): (() => void) => {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener()
      } catch {}
    }
  }
}

export const ambientAudio = new AmbientAudioManager()

export function useAmbientAudio() {
  const isEnabled = useSyncExternalStore(
    ambientAudio.subscribe,
    () => ambientAudio.isEnabled(),
    () => true
  )
  const isPlaying = useSyncExternalStore(
    ambientAudio.subscribe,
    () => ambientAudio.isPlaying(),
    () => false
  )

  return {
    isEnabled,
    isPlaying,
    toggle: () => ambientAudio.toggle(),
    play: () => ambientAudio.play(),
    pause: () => ambientAudio.pause(),
    setEnabled: (val: boolean) => ambientAudio.setEnabled(val),
  }
}
