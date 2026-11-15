import { create } from 'zustand'
import { BASE_URL, toApiUrl } from '../api'

export { BASE_URL }
export const API_URL = BASE_URL

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

export const DEFAULT_GUIDE_TARGET: GuideTarget = { id: 'rcw-36', name: 'RCW 36 Emission Nebula' }

/**
 * Mengirim pesan prompt ke backend /api/ai/chat
 * Semua permintaan diarahkan ke backend live: https://nasa-spherex-backend.vercel.app
 * Format: Method POST, headers Content-Type: application/json, body: {"message": "..."}
 */
export async function sendChatMessage(message: string): Promise<string> {
  const primaryEndpoint = toApiUrl('/api/ai/chat')
  const payload = JSON.stringify({ message })
  const headers = { 'Content-Type': 'application/json' }

  const response = await fetch(primaryEndpoint, {
    method: 'POST',
    headers,
    body: payload,
  })

  if (response.ok) {
    const data = await response.json()
    if (typeof data?.reply === 'string' && data.reply.trim().length > 0) {
      return data.reply.trim()
    }
  }

  return 'Maaf, Cosmic Guide sedang sibuk. Silakan coba lagi.'
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
  // lang is accepted but ignored — /api/ai/chat is language-agnostic
  sendMessage: (message: string, lang?: string) => Promise<string>
  clearMessages: () => void
}

export const useGuide = create<GuideState>((set, get) => ({
  open: false,
  target: DEFAULT_GUIDE_TARGET,
  messages: [],
  loading: false,
  error: null,
  openGuide: (target) => set((state) => ({ open: true, target: target ?? state.target })),
  closeGuide: () => set({ open: false }),
  setGuideTarget: (target) => set({ target }),
  clearMessages: () => set({ messages: [], error: null }),
  sendMessage: async (text: string, _lang?: string) => {
    const cleanText = text.trim()
    if (!cleanText || get().loading) return ''

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: cleanText,
      timestamp: Date.now(),
    }

    set((state) => ({
      messages: [...state.messages, userMsg],
      loading: true,
      error: null,
    }))

    try {
      const reply = await sendChatMessage(cleanText)
      const assistantMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: Date.now(),
      }
      set((state) => ({
        messages: [...state.messages, assistantMsg],
        loading: false,
      }))
      return reply
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      const fallbackMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: 'Maaf, Cosmic Guide sedang sibuk. Silakan coba lagi.',
        timestamp: Date.now(),
      }
      set((state) => ({
        messages: [...state.messages, fallbackMsg],
        loading: false,
        error: errorMsg,
      }))
      return fallbackMsg.content
    }
  },
}))
