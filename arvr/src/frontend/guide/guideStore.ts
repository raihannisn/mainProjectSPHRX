import { create } from 'zustand'
import { requestAgentChat, BASE_URL } from '../api'

export { BASE_URL }
export const API_URL = BASE_URL

let requestGeneration = 0

export interface GuideTarget {
  id: string
  name: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface GuideState {
  open: boolean
  target: GuideTarget | null
  messages: ChatMessage[]
  loading: boolean
  error: string | null
  openGuide: (target?: GuideTarget) => void
  closeGuide: () => void
  setGuideTarget: (target: GuideTarget | null) => void
  sendMessage: (message: string) => Promise<string>
  clearMessages: () => void
}

export const useGuide = create<GuideState>((set, get) => ({
  open: false,
  target: null,
  messages: [],
  loading: false,
  error: null,
  openGuide: (target) => {
    if (target && target.id !== get().target?.id) {
      requestGeneration += 1
      set({ open: true, target, messages: [], loading: false, error: null })
      return
    }
    set((state) => ({ open: true, target: target ?? state.target }))
  },
  closeGuide: () => set({ open: false }),
  setGuideTarget: (target) => {
    if (target?.id !== get().target?.id) {
      requestGeneration += 1
      set({ target, messages: [], loading: false, error: null })
      return
    }
    set({ target })
  },
  clearMessages: () => {
    requestGeneration += 1
    set({ messages: [], error: null })
  },
  sendMessage: async (text) => {
    const cleanText = text.trim()
    if (!cleanText || get().loading) return ''

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: cleanText,
      timestamp: Date.now(),
    }
    const requestMessages = [...get().messages, userMsg].slice(-10)
    const objectId = get().target?.id
    const generation = ++requestGeneration

    set((state) => ({
      messages: [...state.messages, userMsg],
      loading: true,
      error: null,
    }))

    try {
      const result = await requestAgentChat(requestMessages, objectId, 'en')
      if (generation !== requestGeneration) return ''
      if (!result.ok) throw new Error(result.error)

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.text,
        timestamp: Date.now(),
      }
      set((state) => ({
        messages: [...state.messages, assistantMsg],
        loading: false,
      }))
      return result.text
    } catch (error: unknown) {
      if (generation !== requestGeneration) return ''
      set({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      })
      return ''
    }
  },
}))
