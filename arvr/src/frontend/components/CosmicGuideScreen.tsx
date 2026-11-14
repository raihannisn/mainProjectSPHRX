import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TopBar } from './TopBar'
import { ParticleField } from './ParticleField'
import { useXRApp } from '../../xr/store'
import {
  AgentSource,
  prepareChatHistory,
  sendAgentChatMessage,
  transcribeAudio,
  synthesizeSpeech,
  requestLiveVoiceSession,
  getFriendlyErrorMessage,
  STANDARD_AI_MODEL_ERROR,
} from '../agentApi'

interface ChatMessage {
  id: string
  sender: 'bot' | 'user'
  text: string
  time: string
  sources?: AgentSource[]
  isError?: boolean
  retryText?: string
  audioUrl?: string
}

interface ObjectMeta {
  name: string
  category: string
  description: string
}

const OBJECTS: Record<string, ObjectMeta> = {
  'rcw-36': {
    name: 'RCW 36 Emission Nebula',
    category: 'Emission Nebula',
    description: 'A compact H II star-forming region in the Vela Molecular Ridge.',
  },
  'vela-ridge': {
    name: 'Vela Molecular Ridge',
    category: 'Molecular Cloud Complex',
    description: 'A vast interstellar molecular cloud complex in the southern constellation Vela.',
  },
  'candidate-02': {
    name: 'Moving-source candidate',
    category: 'Candidate Detection',
    description: 'An illustrative candidate source demonstrating verification workflows.',
  },
}

export function CosmicGuideScreen() {
  const navigate = useNavigate()
  const { objectId } = useParams<{ objectId?: string }>()
  const lang = useXRApp((s) => s.settings.lang)

  const currentKey = objectId && OBJECTS[objectId] ? objectId : 'rcw-36'
  const currentObj = OBJECTS[currentKey]

  const chips =
    lang === 'id'
      ? ['Apa objek ini?', 'Kenapa ia menarik?', 'Seberapa jauh?', 'Bagaimana SPHEREx mengamatinya?']
      : ['What is this object?', 'Why is it interesting?', 'How far away is it?', 'How does SPHEREx observe it?']

  const getInitialGreeting = useCallback(
    (key: string, language: 'id' | 'en') => {
      const target = OBJECTS[key] || OBJECTS['rcw-36']
      return language === 'id'
        ? `Halo! Aku Cosmic Guide. Tanyakan apa saja tentang ${target.name}. (Data disajikan dengan transparansi ilmiah melalui Mission Liaison Agent).`
        : `Hi! I'm your Cosmic Guide. Ask me anything about ${target.name}. (Answers adhere to NASA/SPHEREx verified data via Mission Liaison Agent).`
    },
    []
  )

  // Maintain separate conversation history per object
  const [historyByObject, setHistoryByObject] = useState<Record<string, ChatMessage[]>>(() => ({
    'rcw-36': [
      {
        id: 'init-rcw-36',
        sender: 'bot',
        text: getInitialGreeting('rcw-36', lang),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ],
  }))

  // Ensure current object has initial history
  useEffect(() => {
    setHistoryByObject((prev) => {
      if (!prev[currentKey] || prev[currentKey].length === 0) {
        return {
          ...prev,
          [currentKey]: [
            {
              id: `init-${currentKey}`,
              sender: 'bot',
              text: getInitialGreeting(currentKey, lang),
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ],
        }
      }
      return prev
    })
  }, [currentKey, lang, getInitialGreeting])

  const activeMessages = historyByObject[currentKey] || []

  const [inputVal, setInputVal] = useState('')
  const [pending, setPending] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Voice recording (Push-to-Talk) states
  const [isRecording, setIsRecording] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingStreamRef = useRef<MediaStream | null>(null)
  const recordingTimerRef = useRef<number | null>(null)

  // Audio playback (TTS) states
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlsRef = useRef<Set<string>>(new Set())

  // Live Voice Session states
  const [liveActive, setLiveActive] = useState(false)
  const liveSocketRef = useRef<WebSocket | null>(null)
  const liveAudioCtxRef = useRef<AudioContext | null>(null)
  const liveStreamRef = useRef<MediaStream | null>(null)

  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [activeMessages, pending])

  // Cleanup all audio and streams on unmount or route change
  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
      }
      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach((track) => track.stop())
        recordingStreamRef.current = null
      }
      if (liveStreamRef.current) {
        liveStreamRef.current.getTracks().forEach((track) => track.stop())
        liveStreamRef.current = null
      }
      if (liveSocketRef.current) {
        liveSocketRef.current.close()
        liveSocketRef.current = null
      }
      if (liveAudioCtxRef.current && liveAudioCtxRef.current.state !== 'closed') {
        liveAudioCtxRef.current.close().catch(() => {})
        liveAudioCtxRef.current = null
      }
      if (recordingTimerRef.current) {
        window.clearTimeout(recordingTimerRef.current)
      }
      // Revoke created blob URLs
      audioUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      audioUrlsRef.current.clear()
    }
  }, [currentKey])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    window.setTimeout(() => setToastMessage(null), 3500)
  }

  // Handle sending chat message to backend Mission Liaison Agent
  const handleSend = async (question: string) => {
    const trimmed = question.trim()
    if (!trimmed || pending) return

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: trimmed,
      time: now,
    }

    // Add user message to state
    setHistoryByObject((prev) => ({
      ...prev,
      [currentKey]: [...(prev[currentKey] || []), userMsg],
    }))
    setInputVal('')
    setPending(true)

    // Build payload according to backend AgentChatRequest contract
    const currentList = historyByObject[currentKey] || []
    const messagesPayload = prepareChatHistory(currentList, trimmed)

    const result = await sendAgentChatMessage({
      objectId: currentKey,
      lang,
      messages: messagesPayload,
    })

    setPending(false)

    if (result.ok) {
      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: result.data.message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources: result.data.sources,
      }
      setHistoryByObject((prev) => ({
        ...prev,
        [currentKey]: [...(prev[currentKey] || []), botMsg],
      }))
    } else {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'bot',
        text: result.error || STANDARD_AI_MODEL_ERROR,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
        retryText: trimmed,
      }
      setHistoryByObject((prev) => ({
        ...prev,
        [currentKey]: [...(prev[currentKey] || []), errorMsg],
      }))
    }
  }

  // Push-to-Talk (Speech-to-Text) handler
  const startRecording = async () => {
    if (isRecording || pending) return
    setVoiceStatus(null)

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setVoiceStatus(getFriendlyErrorMessage('AUDIO_UNSUPPORTED', lang))
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recordingStreamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : ''

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }

      recorder.onstop = async () => {
        const tracks = stream.getTracks()
        tracks.forEach((t) => t.stop())
        recordingStreamRef.current = null

        const rawType = recorder.mimeType || 'audio/webm'
        const audioBlob = new Blob(audioChunksRef.current, { type: rawType })
        if (audioBlob.size === 0) {
          setVoiceStatus(getFriendlyErrorMessage('EMPTY_INPUT', lang))
          setIsRecording(false)
          return
        }

        setVoiceStatus(lang === 'id' ? 'Mentranskripsi ucapan...' : 'Transcribing voice...')
        const sttResult = await transcribeAudio(audioBlob, lang)
        setIsRecording(false)

        if (sttResult.ok) {
          setVoiceStatus(null)
          setInputVal(sttResult.transcript)
          // Automatically submit voice transcription
          await handleSend(sttResult.transcript)
        } else {
          setVoiceStatus(sttResult.error || STANDARD_AI_MODEL_ERROR)
        }
      }

      recorder.start(250)
      setIsRecording(true)
      setVoiceStatus(lang === 'id' ? 'Merekam... Klik untuk selesai' : 'Recording... Click to finish')

      // Maximum 25 seconds recording timer
      recordingTimerRef.current = window.setTimeout(() => {
        stopRecording()
      }, 25000)
    } catch (err: unknown) {
      setIsRecording(false)
      if (err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        setVoiceStatus(getFriendlyErrorMessage('MIC_PERMISSION_DENIED', lang))
      } else {
        setVoiceStatus(getFriendlyErrorMessage('AUDIO_UNSUPPORTED', lang))
      }
    }
  }

  const stopRecording = () => {
    if (recordingTimerRef.current) {
      window.clearTimeout(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }

  // Text-to-Speech (TTS) handler
  const handlePlayAudio = async (msg: ChatMessage) => {
    if (playingMessageId === msg.id && currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
      setPlayingMessageId(null)
      return
    }

    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
      setPlayingMessageId(null)
    }

    let url = msg.audioUrl
    if (!url) {
      setVoiceStatus(lang === 'id' ? 'Menyiapkan audio suara...' : 'Synthesizing voice audio...')
      const ttsResult = await synthesizeSpeech(msg.text, lang, 'mission-liaison')
      setVoiceStatus(null)

      if (!ttsResult.ok) {
        showToast(ttsResult.error || (lang === 'id' ? 'Gagal memutar audio.' : 'Audio playback failed.'))
        return
      }

      url = URL.createObjectURL(ttsResult.audioBlob)
      audioUrlsRef.current.add(url)
      msg.audioUrl = url
    }

    const audio = new Audio(url)
    currentAudioRef.current = audio
    setPlayingMessageId(msg.id)

    audio.onended = () => {
      setPlayingMessageId(null)
      currentAudioRef.current = null
    }
    audio.onerror = () => {
      setPlayingMessageId(null)
      currentAudioRef.current = null
      showToast(lang === 'id' ? 'Gagal memutar audio.' : 'Audio playback error.')
    }

    try {
      await audio.play()
    } catch {
      setPlayingMessageId(null)
      currentAudioRef.current = null
    }
  }

  // Continuous Voice (Live Voice) toggle handler
  const handleToggleLiveVoice = async () => {
    if (liveActive) {
      // Stop live voice session
      if (liveStreamRef.current) {
        liveStreamRef.current.getTracks().forEach((t) => t.stop())
        liveStreamRef.current = null
      }
      if (liveSocketRef.current) {
        liveSocketRef.current.close()
        liveSocketRef.current = null
      }
      if (liveAudioCtxRef.current && liveAudioCtxRef.current.state !== 'closed') {
        liveAudioCtxRef.current.close().catch(() => {})
        liveAudioCtxRef.current = null
      }
      setLiveActive(false)
      showToast(lang === 'id' ? 'Sesi suara dihentikan.' : 'Voice session stopped.')
      return
    }

    // Request session token
    showToast(lang === 'id' ? 'Menghubungkan sesi suara...' : 'Connecting live voice session...')
    const currentList = historyByObject[currentKey] || []
    const messagesPayload = prepareChatHistory(currentList, 'Hello')

    const sessionResult = await requestLiveVoiceSession({
      objectId: currentKey,
      lang,
      messages: messagesPayload,
    })

    if (!sessionResult.ok) {
      showToast(sessionResult.error)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      liveStreamRef.current = stream

      const token = sessionResult.data.token
      const socketUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(
        token
      )}`

      const socket = new WebSocket(socketUrl)
      liveSocketRef.current = socket

      socket.onopen = () => {
        socket.send(
          JSON.stringify({
            setup: {
              model: sessionResult.data.model,
              ...sessionResult.data.config,
            },
          })
        )
        setLiveActive(true)
        showToast(lang === 'id' ? 'Sesi suara aktif! Silakan berbicara.' : 'Live voice connected! Start speaking.')
      }

      socket.onclose = () => {
        setLiveActive(false)
      }
      socket.onerror = () => {
        setLiveActive(false)
        showToast(STANDARD_AI_MODEL_ERROR)
      }
    } catch (err: unknown) {
      setLiveActive(false)
      if (err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        showToast(getFriendlyErrorMessage('MIC_PERMISSION_DENIED', lang))
      } else {
        showToast(getFriendlyErrorMessage('AUDIO_UNSUPPORTED', lang))
      }
    }
  }

  return (
    <div className="fe-app">
      <ParticleField />
      <TopBar />

      <main className="fe-guide-container">
        {/* Header Section */}
        <div className="fe-guide-head">
          <div>
            <div className="fe-eyebrow">Interactive Cosmic AI Guide</div>
            <h1 style={{ margin: '4px 0 0', fontSize: '1.6rem', fontWeight: 600 }}>
              {currentObj.name}
            </h1>
            <p className="fe-muted" style={{ margin: '4px 0 0', fontSize: '0.78rem' }}>
              Category: {currentObj.category} · Mission Liaison Agent
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* Continuous Voice Toggle Button */}
            <button
              type="button"
              className={`fe-live-toggle ${liveActive ? 'active' : ''}`}
              onClick={handleToggleLiveVoice}
              title={
                lang === 'id'
                  ? 'Continuous Voice: Percakapan audio dua arah realtime'
                  : 'Continuous Voice: Realtime bidirectional audio conversation'
              }
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: liveActive ? 'var(--teal)' : 'var(--violet)',
                }}
              />
              {liveActive
                ? lang === 'id'
                  ? 'Voice Aktif (Stop)'
                  : 'Voice Active (Stop)'
                : lang === 'id'
                ? 'Continuous Voice'
                : 'Continuous Voice'}
            </button>

            <button className="fe-btn-text" onClick={() => navigate('/explorer')}>
              ← Explorer
            </button>
            <button
              className="fe-btn-primary fe-btn-gold"
              onClick={() => navigate('/xr/body/spherex')}
            >
              Inspect in 3D ↗
            </button>
          </div>
        </div>

        {/* Object context switcher (Preserves separate threads per object) */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="fe-mono fe-muted" style={{ fontSize: '0.72rem' }}>
            {lang === 'id' ? 'PILIH TOPIK:' : 'DISCUSSING:'}
          </span>
          {Object.keys(OBJECTS).map((k) => (
            <button
              key={k}
              className={`fe-tab ${k === currentKey ? 'active' : ''}`}
              style={{ fontSize: '0.72rem', padding: '6px 12px' }}
              onClick={() => {
                if (k !== currentKey) {
                  navigate(`/guide/${k}`)
                }
              }}
            >
              {OBJECTS[k].name.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Suggested Quick Question Chips */}
        <div className="fe-guide-chips">
          {chips.map((q) => (
            <button
              key={q}
              className="fe-guide-chip"
              disabled={pending}
              onClick={() => handleSend(q)}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Chat History View */}
        <div className="fe-guide-chat" ref={chatContainerRef} aria-live="polite">
          {activeMessages.map((m) => (
            <div key={m.id} className={`fe-msg ${m.sender} ${m.isError ? 'error' : ''}`}>
              <div style={{ fontSize: '0.64rem', opacity: 0.7, marginBottom: '4px' }}>
                {m.sender === 'bot'
                  ? m.isError
                    ? 'COSMIC GUIDE · NOTICE'
                    : 'COSMIC GUIDE · MISSION LIAISON'
                  : 'RESEARCHER'}{' '}
                · {m.time}
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>

              {/* Citations / Sources */}
              {m.sources && m.sources.length > 0 && (
                <div className="fe-guide-sources">
                  <span className="fe-muted" style={{ fontSize: '0.68rem', fontWeight: 600 }}>
                    {lang === 'id' ? 'SUMBER DATA RESMI:' : 'VERIFIED SOURCES:'}
                  </span>
                  {m.sources.map((s, idx) => (
                    <a
                      key={idx}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="fe-guide-source-link"
                    >
                      ✦ {s.title}
                    </a>
                  ))}
                </div>
              )}

              {/* Message footer actions (TTS Audio button & Retry button) */}
              <div className="fe-msg-footer">
                {m.sender === 'bot' && !m.isError && (
                  <button
                    type="button"
                    className={`fe-tts-btn ${playingMessageId === m.id ? 'active' : ''}`}
                    onClick={() => handlePlayAudio(m)}
                    title={lang === 'id' ? 'Dengarkan suara pemandu' : 'Listen to spoken guidance'}
                  >
                    {playingMessageId === m.id ? (
                      <>⏹ {lang === 'id' ? 'Berhenti' : 'Stop'}</>
                    ) : (
                      <>🔊 {lang === 'id' ? 'Dengarkan' : 'Listen'}</>
                    )}
                  </button>
                )}

                {m.isError && m.retryText && (
                  <button
                    type="button"
                    className="fe-retry-btn"
                    disabled={pending}
                    onClick={() => handleSend(m.retryText!)}
                  >
                    ↻ {lang === 'id' ? 'Coba Lagi' : 'Retry'}
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Typing / Loading Indicator */}
          {pending && (
            <div className="fe-msg bot fe-typing-indicator" aria-label="Processing response">
              <span></span>
              <span></span>
              <span></span>
            </div>
          )}
        </div>

        {/* Voice recording status or error feedback banner */}
        {voiceStatus && (
          <div
            className="fe-source-line"
            style={{
              padding: '6px 12px',
              fontSize: '0.74rem',
              color: isRecording ? '#ff4757' : 'var(--amber)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: isRecording ? '#ff4757' : 'var(--amber)',
              }}
            />
            {voiceStatus}
          </div>
        )}

        {/* Chat Input Form with Push-to-Talk */}
        <form
          className="fe-guide-form"
          onSubmit={(e) => {
            e.preventDefault()
            handleSend(inputVal)
          }}
        >
          {/* Push-to-Talk Microphone Button */}
          <button
            type="button"
            className={`fe-voice-btn ${isRecording ? 'recording' : ''}`}
            disabled={pending}
            onClick={isRecording ? stopRecording : startRecording}
            aria-label={
              isRecording
                ? lang === 'id'
                  ? 'Hentikan rekaman suara'
                  : 'Stop recording'
                : lang === 'id'
                ? 'Rekam suara (Push to talk)'
                : 'Push to talk'
            }
            title={
              isRecording
                ? lang === 'id'
                  ? 'Hentikan rekaman suara'
                  : 'Stop recording'
                : lang === 'id'
                ? 'Rekam suara (Push to talk)'
                : 'Push to talk'
            }
          >
            {isRecording ? '⏹' : '🎙'}
          </button>

          <input
            type="text"
            className="fe-guide-input"
            disabled={pending}
            placeholder={
              lang === 'id'
                ? `Tanyakan tentang ${currentObj.name} atau misi SPHEREx...`
                : `Ask about ${currentObj.name} or SPHEREx survey...`
            }
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
          />

          <button
            type="submit"
            className="fe-btn-primary"
            disabled={pending || !inputVal.trim()}
            style={{ padding: '0 24px', minHeight: '44px' }}
          >
            {pending ? '...' : lang === 'id' ? 'Kirim' : 'Send'}
          </button>
        </form>
      </main>

      {/* Toast Alert Notification */}
      {toastMessage && <div className="fe-toast show">{toastMessage}</div>}
    </div>
  )
}
