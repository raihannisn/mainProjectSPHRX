import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ASK_GUIDE_EVENT } from '../../xr/events'
import type { GuideRequest } from '../../xr/types'
import { BotIcon } from '../guide/BotIcon'
import { useGuide } from '../guide/guideStore'
import { MicIcon } from '../guide/MicIcon'
import { SpeakerIcon } from '../guide/SpeakerIcon'
import { useGuideSpeech } from '../guide/useGuideSpeech'
import { useVoiceInput, voiceInputSupported } from '../guide/useVoiceInput'

interface CosmicGuideWindowProps {
  fullPage?: boolean
  initialObjectId?: string
  /** Full-page (mobile) presentation only: shows a back button in the header. */
  onBack?: () => void
}

interface OpenGuideDetail {
  objectId?: string
  objectName?: string
  returnFocus?: HTMLElement
}

const voiceInputLanguage: 'en' | 'id' =
  typeof navigator !== 'undefined' && /^(id|in)(-|$)/i.test(navigator.language)
    ? 'id'
    : 'en'

export function CosmicGuideWindow({ fullPage = false, initialObjectId, onBack }: CosmicGuideWindowProps) {
  const [open, setOpen] = useState(fullPage)
  const [closing, setClosing] = useState(false)
  const [context, setContext] = useState(initialObjectId ?? '')
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const { messages, loading, error, sendMessage, setGuideTarget } = useGuide()
  const voice = useGuideSpeech(messages, open && !closing)
  // Push-to-talk: the spoken question is sent as typed text would be, and its answer is read aloud
  const mic = useVoiceInput(voiceInputLanguage, (text) => {
    voice.speakNext()
    void sendMessage(text)
  })
  const micCancel = mic.cancel
  useEffect(() => {
    if (!open || closing) micCancel()
  }, [open, closing, micCancel])

  const show = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setClosing(false)
    setOpen(true)
  }, [])

  const close = useCallback(() => {
    if (!open || closing || fullPage) return
    setClosing(true)
    returnFocusRef.current?.focus()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setOpen(false)
      setClosing(false)
      return
    }
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false)
      setClosing(false)
      closeTimerRef.current = null
    }, 240)
  }, [open, closing, fullPage])

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current)
  }, [])

  useEffect(() => {
    if (fullPage) return

    const openGuide = (event: Event) => {
      const detail = (event as CustomEvent<OpenGuideDetail>).detail
      returnFocusRef.current =
        detail?.returnFocus ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
      setContext(detail?.objectName || detail?.objectId || '')
      const objectId = detail?.objectId?.trim()
      setGuideTarget(objectId ? { id: objectId, name: detail?.objectName?.trim() || objectId } : null)
      setDraft('')
      show()
    }
    const openForXRRequest = (event: Event) => {
      const { body, hotspotId, guidePrompt } = (event as CustomEvent<GuideRequest>).detail
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setContext([body, hotspotId].filter(Boolean).join(' · '))
      const objectId = body.trim()
      setGuideTarget(objectId ? { id: objectId, name: objectId } : null)
      setDraft(guidePrompt || '')
      show()
    }

    window.addEventListener('cosmic:open-guide', openGuide)
    window.addEventListener(ASK_GUIDE_EVENT, openForXRRequest)
    return () => {
      window.removeEventListener('cosmic:open-guide', openGuide)
      window.removeEventListener(ASK_GUIDE_EVENT, openForXRRequest)
    }
  }, [fullPage, setGuideTarget, show])

  useEffect(() => {
    if (!fullPage) return
    const objectId = initialObjectId?.trim()
    setContext(objectId ?? '')
    setGuideTarget(objectId ? { id: objectId, name: objectId } : null)
  }, [fullPage, initialObjectId, setGuideTarget])

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [messages, loading])

  useEffect(() => {
    if (!open || closing || fullPage) return
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    const onPointerDown = (event: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) close()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open, closing, fullPage, close])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || loading) return
    setDraft('')
    voice.unlock()
    await sendMessage(text)
  }

  const handleChipClick = (chipText: string) => {
    if (!loading) {
      voice.unlock()
      void sendMessage(chipText)
    }
  }

  if (!open) return null

  const panel = (
    <section
      className={`cg-window${fullPage ? ' cg-window--page' : ''}${closing ? ' cg-window--closing' : ''}`}
      ref={panelRef}
      role={fullPage ? 'region' : 'dialog'}
      aria-modal={fullPage ? undefined : false}
      aria-hidden={closing || undefined}
      inert={closing}
      aria-labelledby="cg-title"
    >
      <header className="cg-head">
        {fullPage && onBack && (
          <button type="button" className="cg-icon-btn cg-icon-btn--back" aria-label="Back" title="Back" onClick={onBack}>
            ←
          </button>
        )}
        <span className="cg-head-icon"><BotIcon /></span>
        <span className="cg-head-text">
          <h1 className="cg-title" id="cg-title">Cosmic Guide</h1>
          <p className="cg-sub">{context || 'SPHEREx AI Assistant'}</p>
        </span>
        <button
          type="button"
          className={`cg-icon-btn cg-icon-btn--voice${voice.enabled ? ' is-on' : ''}${voice.status === 'playing' ? ' is-speaking' : ''}`}
          aria-pressed={voice.enabled}
          aria-label={voice.enabled ? 'Turn voice answers off' : 'Read answers aloud'}
          title={
            voice.status === 'error'
              ? 'AI voice unavailable'
              : voice.status === 'loading'
                ? 'Preparing AI voice…'
                : voice.enabled
                  ? 'Voice answers on'
                  : 'Read answers aloud'
          }
          onClick={voice.toggle}
        >
          <SpeakerIcon />
        </button>
        {!fullPage && (
          <button type="button" className="cg-icon-btn cg-icon-btn--close" aria-label="Close" onClick={close}>
            ×
          </button>
        )}
      </header>

      <div className="cg-thread" ref={threadRef} role="status" aria-live="polite">
        {messages.length === 0 ? (
          <p className="cg-empty" role="status">
            {context
              ? `Ask a question about ${context}.`
              : 'Ask about SPHEREx or an object available in the catalog.'}
          </p>
        ) : (
          messages.map((msg) =>
            msg.role === 'user' ? (
              <p key={msg.id} className="cg-msg cg-msg--user">
                {msg.content}
              </p>
            ) : (
              <div key={msg.id} className="cg-msg cg-msg--bot cg-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              </div>
            )
          )
        )}
        {error && <p className="cg-error" role="alert">{error}</p>}
        {mic.error && <p className="cg-error" role="alert">{mic.error}</p>}
        {voice.error && <p className="cg-error" role="alert">Voice playback is temporarily unavailable. Please try again later.</p>}
        {loading && (
          <p className="cg-msg cg-msg--bot" style={{ opacity: 0.7, fontStyle: 'italic' }}>
            Cosmic Guide is thinking…
          </p>
        )}
      </div>

      <div className="cg-chips">
        <button
          type="button"
          className="cg-chip"
          disabled={loading}
          onClick={() => handleChipClick('What is SPHEREx’s primary mission?')}
        >
          SPHEREx Mission
        </button>
        <button
          type="button"
          className="cg-chip"
          disabled={loading}
          onClick={() => handleChipClick('How does SPHEREx detect water and ice molecules in space?')}
        >
          Water Ice Search
        </button>
        <button
          type="button"
          className="cg-chip"
          disabled={loading}
          onClick={() => handleChipClick('What are the advantages of all-sky spectroscopy across 102 infrared bands?')}
        >
          Infrared All-Sky
        </button>
      </div>

      <p className="cg-note">
        <span className="cg-note-tag">MISSION AGENT</span>
        Answers use backend catalog records when available; missing data is not guessed.
      </p>

      <form className="cg-form" onSubmit={submit}>
        <input
          ref={inputRef}
          className="cg-input"
          value={draft}
          disabled={loading || mic.status !== 'idle'}
          maxLength={500}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={
            mic.status === 'recording'
              ? 'Listening… tap the mic to send'
              : mic.status === 'transcribing'
                ? 'Transcribing your question…'
                : 'Ask Cosmic Guide a question…'
          }
          aria-label="Question for Cosmic Guide"
        />
        {voiceInputSupported() && (
          <button
            type="button"
            className={`cg-mic${mic.status === 'recording' ? ' is-recording' : ''}`}
            onClick={mic.toggle}
            disabled={loading || mic.status === 'transcribing'}
            aria-pressed={mic.status === 'recording'}
            aria-label={mic.status === 'recording' ? 'Stop recording and send' : 'Ask by voice'}
            title={mic.status === 'recording' ? 'Stop recording and send' : 'Ask by voice'}
          >
            <MicIcon />
          </button>
        )}
        <button type="submit" className="cg-send" disabled={!draft.trim() || loading} aria-label="Send">
          ↗
        </button>
      </form>
    </section>
  )

  return fullPage ? panel : createPortal(panel, document.body)
}
