import { create } from 'zustand'

/**
 * Floating Cosmic Guide state.
 *
 * The guide is a UI shell only: answers arrive later from an external LLM API
 * (see `requestGuideReply` in `../api`). Nothing is stored here but the open
 * flag and the target the visitor is currently looking at.
 */
export interface GuideTarget {
  id: string
  name: string
}

export const DEFAULT_GUIDE_TARGET: GuideTarget = { id: 'rcw-36', name: 'RCW 36 Emission Nebula' }

interface GuideState {
  open: boolean
  target: GuideTarget
  openGuide: (target?: GuideTarget) => void
  closeGuide: () => void
  setGuideTarget: (target: GuideTarget) => void
}

export const useGuide = create<GuideState>((set) => ({
  open: false,
  target: DEFAULT_GUIDE_TARGET,
  openGuide: (target) => set((state) => ({ open: true, target: target ?? state.target })),
  closeGuide: () => set({ open: false }),
  setGuideTarget: (target) => set({ target }),
}))
