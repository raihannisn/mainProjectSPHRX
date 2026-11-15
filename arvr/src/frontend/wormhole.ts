/**
 * Wormhole transition controller.
 *
 * A single `WormholeOverlay` mounts the canvas engine and registers itself here, so any screen can
 * wrap real work (route change, scene load) in the full-screen transition without owning the
 * animation. When the overlay is not mounted the helper degrades to running the task directly.
 */

export type WormholeOrigin = { x: number; y: number }

export type WormholeOptions = {
  /** Viewport point where the portal opens (trigger button or pointer). Defaults to screen centre. */
  origin?: WormholeOrigin
  /** Accessible status text shown inside the overlay. */
  label?: string
  /** Minimum time the overlay stays up, in ms. Animation floor only — there is no fake progress. */
  minMs?: number
  /** Whether to wait for XR 3D scene loading before closing. Set to false for 2D page transitions. */
  waitForScene?: boolean
}

export type WormholeTask = () => void | Promise<void>
export type WormholeRunner = (options?: WormholeOptions, task?: WormholeTask) => Promise<void>

let runner: WormholeRunner | null = null

export function registerWormhole(next: WormholeRunner): () => void {
  runner = next
  return () => {
    if (runner === next) runner = null
  }
}

/** Runs real work behind the wormhole overlay. Resolves once the overlay has finished closing. */
export async function runWormhole(options: WormholeOptions = {}, task?: WormholeTask): Promise<void> {
  if (!runner) {
    await task?.()
    return
  }
  await runner(options, task)
}

/** Centre of the trigger element, or the pointer position, as a portal origin. */
export function originOf(target: Element | { clientX: number; clientY: number } | null | undefined) {
  if (!target) return undefined
  if (target instanceof Element) {
    const rect = target.getBoundingClientRect()
    if (!rect.width && !rect.height) return undefined
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  }
  return { x: target.clientX, y: target.clientY }
}
