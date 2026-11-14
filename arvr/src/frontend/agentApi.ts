/**
 * Mission Liaison Agent API Client for SPHEREx Cosmic Guide.
 * Communicates with backend /api/agent endpoints using relative paths proxied by Vite.
 */

export type AgentRole = 'user' | 'bot'

export interface AgentChatMessage {
  role: AgentRole
  content: string
}

export interface AgentSource {
  title: string
  url: string
}

export interface AgentChatData {
  message: string
  sources: AgentSource[]
}

export interface AgentLiveSessionData {
  token: string
  model: string
  config: Record<string, unknown>
  history: AgentChatMessage[]
  sources: AgentSource[]
  expiresAt: string
}

export type AgentErrorCode =
  | 'AI_QUOTA_EXCEEDED'
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'AI_MODEL_FAILURE'
  | 'AI_TIMEOUT'
  | 'AI_STT_FAILURE'
  | 'MIC_PERMISSION_DENIED'
  | 'AUDIO_UNSUPPORTED'
  | 'EMPTY_INPUT'
  | 'APP_RATE_LIMIT'
  | 'NETWORK_OFFLINE'
  | 'UNKNOWN_ERROR'

export const STANDARD_AI_MODEL_ERROR = 'Model sedang tidak tersedia. Silakan coba kembali beberapa saat lagi.'

export function getFriendlyErrorMessage(code: AgentErrorCode, lang: 'id' | 'en'): string {
  switch (code) {
    case 'AI_QUOTA_EXCEEDED':
    case 'AI_PROVIDER_UNAVAILABLE':
    case 'AI_MODEL_FAILURE':
    case 'AI_TIMEOUT':
    case 'AI_STT_FAILURE':
      return STANDARD_AI_MODEL_ERROR
    case 'MIC_PERMISSION_DENIED':
      return lang === 'id'
        ? 'Izin mikrofon diperlukan untuk menggunakan fitur suara. Silakan izinkan akses mikrofon di pengaturan browser Anda.'
        : 'Microphone permission is required to use voice features. Please grant microphone access in your browser.'
    case 'AUDIO_UNSUPPORTED':
      return lang === 'id'
        ? 'Browser Anda tidak mendukung perekaman audio.'
        : 'Your browser does not support audio recording.'
    case 'EMPTY_INPUT':
      return lang === 'id'
        ? 'Pertanyaan atau rekaman suara tidak boleh kosong.'
        : 'Question or audio recording cannot be empty.'
    case 'APP_RATE_LIMIT':
      return lang === 'id'
        ? 'Batas permintaan tercapai. Silakan tunggu satu menit sebelum mencoba kembali.'
        : 'Rate limit reached. Please wait a minute before trying again.'
    case 'NETWORK_OFFLINE':
      return lang === 'id'
        ? 'Koneksi ke server backend gagal. Periksa jaringan Anda.'
        : 'Connection to the backend server failed. Please check your network connection.'
    default:
      return STANDARD_AI_MODEL_ERROR
  }
}

export type AgentChatResult =
  | { ok: true; data: AgentChatData }
  | { ok: false; error: string; code: AgentErrorCode; status?: number }

export type AgentTranscribeResult =
  | { ok: true; transcript: string; language: string }
  | { ok: false; error: string; code: AgentErrorCode; status?: number }

export type AgentLiveSessionResult =
  | { ok: true; data: AgentLiveSessionData }
  | { ok: false; error: string; code: AgentErrorCode; status?: number; disabled?: boolean }

export type AgentTtsResult =
  | { ok: true; audioBlob: Blob }
  | { ok: false; error: string; code: AgentErrorCode; status?: number }

/**
 * Clean and truncate message content to fit backend limits (max 500 chars).
 */
export function sanitizeMessageContent(text: string): string {
  const trimmed = text.trim()
  if (trimmed.length > 500) {
    return trimmed.slice(0, 500)
  }
  return trimmed
}

/**
 * Prepares the conversation history array according to the backend AgentChatRequest contract:
 * - min 1, max 10 messages
 * - each role must be 'user' or 'bot'
 * - content 1-500 chars
 * - last message MUST have role 'user'
 */
export function prepareChatHistory(
  messages: { sender: 'user' | 'bot'; text: string }[],
  latestUserText: string
): AgentChatMessage[] {
  const prepared: AgentChatMessage[] = []

  // Collect previous messages, taking the last 9 so that with the new user message total is <= 10
  const recent = messages.slice(-9)
  for (const m of recent) {
    const content = sanitizeMessageContent(m.text)
    if (content) {
      prepared.push({
        role: m.sender,
        content,
      })
    }
  }

  // Append latest user message
  const userContent = sanitizeMessageContent(latestUserText)
  prepared.push({
    role: 'user',
    content: userContent,
  })

  // Ensure total count is between 1 and 10, and last message is user
  const sliced = prepared.slice(-10)
  if (sliced[sliced.length - 1].role !== 'user') {
    sliced.push({
      role: 'user',
      content: userContent,
    })
  }

  return sliced.slice(-10)
}

/**
 * Sends a chat question to POST /api/agent/chat.
 */
export async function sendAgentChatMessage(params: {
  objectId?: string
  lang: 'id' | 'en'
  messages: AgentChatMessage[]
  timeoutMs?: number
}): Promise<AgentChatResult> {
  const { objectId, lang, messages, timeoutMs = 35000 } = params

  if (!messages || messages.length === 0) {
    return {
      ok: false,
      error: getFriendlyErrorMessage('EMPTY_INPUT', lang),
      code: 'EMPTY_INPUT',
    }
  }

  const safeObjectId =
    objectId && /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(objectId.trim())
      ? objectId.trim().toLowerCase()
      : undefined

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        objectId: safeObjectId,
        lang,
        messages,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      let detail = ''
      try {
        const errorJson = await response.json()
        if (errorJson && typeof errorJson.detail === 'string') {
          detail = errorJson.detail
        }
      } catch {
        // Non-JSON response
      }

      let code: AgentErrorCode = 'AI_MODEL_FAILURE'
      if (response.status === 429) {
        code = detail.includes('Batas permintaan Agent') ? 'APP_RATE_LIMIT' : 'AI_QUOTA_EXCEEDED'
      } else if (response.status === 503) {
        code = 'AI_PROVIDER_UNAVAILABLE'
      } else if (response.status === 504) {
        code = 'AI_TIMEOUT'
      }

      return {
        ok: false,
        error: getFriendlyErrorMessage(code, lang),
        code,
        status: response.status,
      }
    }

    const json = await response.json()
    if (json.success !== true || !json.data || typeof json.data.message !== 'string') {
      return {
        ok: false,
        error: getFriendlyErrorMessage('AI_MODEL_FAILURE', lang),
        code: 'AI_MODEL_FAILURE',
        status: 502,
      }
    }

    const sources: AgentSource[] = Array.isArray(json.data.sources)
      ? json.data.sources
          .filter(
            (s: unknown): s is AgentSource =>
              typeof s === 'object' &&
              s !== null &&
              typeof (s as Record<string, unknown>).title === 'string' &&
              typeof (s as Record<string, unknown>).url === 'string'
          )
          .map((s: Record<string, unknown>) => ({
            title: String(s.title),
            url: String(s.url),
          }))
      : []

    return {
      ok: true,
      data: {
        message: json.data.message.trim(),
        sources,
      },
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        ok: false,
        error: getFriendlyErrorMessage('AI_TIMEOUT', lang),
        code: 'AI_TIMEOUT',
        status: 504,
      }
    }
    return {
      ok: false,
      error: getFriendlyErrorMessage('NETWORK_OFFLINE', lang),
      code: 'NETWORK_OFFLINE',
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Transcribes audio blob using POST /api/agent/voice/transcribe.
 */
export async function transcribeAudio(
  audioBlob: Blob,
  lang: 'id' | 'en',
  timeoutMs = 45000
): Promise<AgentTranscribeResult> {
  if (!audioBlob || audioBlob.size === 0) {
    return {
      ok: false,
      error: getFriendlyErrorMessage('EMPTY_INPUT', lang),
      code: 'EMPTY_INPUT',
    }
  }

  const mimeType = (audioBlob.type || 'audio/webm').split(';')[0].trim().toLowerCase()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(
      `/api/agent/voice/transcribe?language=${encodeURIComponent(lang)}`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': mimeType,
        },
        body: audioBlob,
        signal: controller.signal,
      }
    )

    if (!response.ok) {
      let code: AgentErrorCode = 'AI_STT_FAILURE'
      if (response.status === 429) code = 'AI_QUOTA_EXCEEDED'
      else if (response.status === 503) code = 'AI_PROVIDER_UNAVAILABLE'
      else if (response.status === 504) code = 'AI_TIMEOUT'

      return {
        ok: false,
        error: getFriendlyErrorMessage(code, lang),
        code,
        status: response.status,
      }
    }

    const json = await response.json()
    const transcript = json?.data?.transcript
    if (json.success !== true || typeof transcript !== 'string' || !transcript.trim()) {
      return {
        ok: false,
        error: getFriendlyErrorMessage('AI_STT_FAILURE', lang),
        code: 'AI_STT_FAILURE',
        status: 422,
      }
    }

    return {
      ok: true,
      transcript: transcript.trim(),
      language: lang,
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        ok: false,
        error: getFriendlyErrorMessage('AI_TIMEOUT', lang),
        code: 'AI_TIMEOUT',
        status: 504,
      }
    }
    return {
      ok: false,
      error: getFriendlyErrorMessage('NETWORK_OFFLINE', lang),
      code: 'NETWORK_OFFLINE',
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Requests a live voice session token from POST /api/agent/voice/session.
 */
export async function requestLiveVoiceSession(params: {
  objectId?: string
  lang: 'id' | 'en'
  messages?: AgentChatMessage[]
  timeoutMs?: number
}): Promise<AgentLiveSessionResult> {
  const { objectId, lang, messages = [], timeoutMs = 15000 } = params
  const safeObjectId =
    objectId && /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(objectId.trim())
      ? objectId.trim().toLowerCase()
      : undefined

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch('/api/agent/voice/session', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        objectId: safeObjectId,
        lang,
        messages: messages.slice(-10),
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      let detail = ''
      try {
        const errorJson = await response.json()
        if (errorJson && typeof errorJson.detail === 'string') {
          detail = errorJson.detail
        }
      } catch {
        // Non-JSON
      }

      if (response.status === 503 && /demo is disabled/i.test(detail)) {
        return {
          ok: false,
          error:
            lang === 'id'
              ? 'Continuous Voice demo sedang dinonaktifkan di backend (atur GEMINI_LIVE_DEMO_ENABLED=true).'
              : 'Continuous Voice demo is disabled on the backend (set GEMINI_LIVE_DEMO_ENABLED=true).',
          code: 'AI_PROVIDER_UNAVAILABLE',
          status: 503,
          disabled: true,
        }
      }

      let code: AgentErrorCode = 'AI_MODEL_FAILURE'
      if (response.status === 429) code = 'AI_QUOTA_EXCEEDED'
      else if (response.status === 503) code = 'AI_PROVIDER_UNAVAILABLE'
      else if (response.status === 504) code = 'AI_TIMEOUT'

      return {
        ok: false,
        error: getFriendlyErrorMessage(code, lang),
        code,
        status: response.status,
      }
    }

    const json = await response.json()
    const data = json?.data
    if (json.success !== true || !data || typeof data.token !== 'string') {
      return {
        ok: false,
        error: getFriendlyErrorMessage('AI_MODEL_FAILURE', lang),
        code: 'AI_MODEL_FAILURE',
        status: 502,
      }
    }

    return {
      ok: true,
      data: {
        token: data.token,
        model: data.model,
        config: data.config || {},
        history: Array.isArray(data.history) ? data.history : [],
        sources: Array.isArray(data.sources) ? data.sources : [],
        expiresAt: data.expiresAt,
      },
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        ok: false,
        error: getFriendlyErrorMessage('AI_TIMEOUT', lang),
        code: 'AI_TIMEOUT',
        status: 504,
      }
    }
    return {
      ok: false,
      error: getFriendlyErrorMessage('NETWORK_OFFLINE', lang),
      code: 'NETWORK_OFFLINE',
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Requests speech audio (WAV) from POST /api/agent/voiceover/text.
 */
export async function synthesizeSpeech(
  text: string,
  lang: 'id' | 'en',
  voicePreset: 'mission-liaison' | 'warm-guide' = 'mission-liaison',
  timeoutMs = 45000
): Promise<AgentTtsResult> {
  const content = sanitizeMessageContent(text)
  if (!content) {
    return {
      ok: false,
      error: getFriendlyErrorMessage('EMPTY_INPUT', lang),
      code: 'EMPTY_INPUT',
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch('/api/agent/voiceover/text', {
      method: 'POST',
      headers: {
        Accept: 'audio/wav',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: content,
        language: lang,
        voicePreset,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      let code: AgentErrorCode = 'AI_MODEL_FAILURE'
      if (response.status === 429) code = 'AI_QUOTA_EXCEEDED'
      else if (response.status === 503) code = 'AI_PROVIDER_UNAVAILABLE'
      else if (response.status === 504) code = 'AI_TIMEOUT'

      return {
        ok: false,
        error: getFriendlyErrorMessage(code, lang),
        code,
        status: response.status,
      }
    }

    const audioBlob = await response.blob()
    if (!audioBlob.type.includes('audio/wav') && !audioBlob.type.includes('audio/wave') && audioBlob.size === 0) {
      return {
        ok: false,
        error: getFriendlyErrorMessage('AI_MODEL_FAILURE', lang),
        code: 'AI_MODEL_FAILURE',
        status: 502,
      }
    }

    return {
      ok: true,
      audioBlob,
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        ok: false,
        error: getFriendlyErrorMessage('AI_TIMEOUT', lang),
        code: 'AI_TIMEOUT',
        status: 504,
      }
    }
    return {
      ok: false,
      error: getFriendlyErrorMessage('NETWORK_OFFLINE', lang),
      code: 'NETWORK_OFFLINE',
    }
  } finally {
    clearTimeout(timer)
  }
}
