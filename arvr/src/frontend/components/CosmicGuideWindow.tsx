import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ASK_GUIDE_EVENT } from '../../xr/events'
import type { GuideRequest } from '../../xr/types'
import { useXRApp } from '../../xr/store'
import { BotIcon } from '../guide/BotIcon'
import { useGuide } from '../guide/guideStore'
import { MicIcon } from '../guide/MicIcon'
import { useGuideSpeech } from '../guide/useGuideSpeech'

interface CosmicGuideWindowProps {
  fullPage?: boolean
  initialObjectId?: string
}

interface OpenGuideDetail {
  objectId?: string
  objectName?: string
  returnFocus?: HTMLElement
}

export function CosmicGuideWindow({ fullPage = false, initialObjectId }: CosmicGuideWindowProps) {
  const lang = useXRApp((state) => state.settings.lang)
  const [open, setOpen] = useState(fullPage)
  const [context, setContext] = useState(initialObjectId ?? '')
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const isIndonesian = lang === 'id'

  const { messages, loading, error, sendMessage, setGuideTarget } = useGuide()
  const voice = useGuideSpeech(messages, lang, open)

  const close = useCallback(() => {
    setOpen(false)
    returnFocusRef.current?.focus()
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
      setOpen(true)
    }
    const openForXRRequest = (event: Event) => {
      const { body, hotspotId, guidePrompt } = (event as CustomEvent<GuideRequest>).detail
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setContext([body, hotspotId].filter(Boolean).join(' · '))
      const objectId = body.trim()
      setGuideTarget(objectId ? { id: objectId, name: objectId } : null)
      setDraft(guidePrompt || '')
      setOpen(true)
    }

    window.addEventListener('cosmic:open-guide', openGuide)
    window.addEventListener(ASK_GUIDE_EVENT, openForXRRequest)
    return () => {
      window.removeEventListener('cosmic:open-guide', openGuide)
      window.removeEventListener(ASK_GUIDE_EVENT, openForXRRequest)
    }
  }, [fullPage, setGuideTarget])

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
    if (!open || fullPage) return
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
  }, [open, fullPage, close])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || loading) return
    setDraft('')
    await sendMessage(text, lang)
  }

  const handleChipClick = (chipText: string) => {
    if (!loading) void sendMessage(chipText, lang)
  }

  if (!open) return null

  const panel = (
    <section
      className={`cg-window${fullPage ? ' cg-window--page' : ''}`}
      ref={panelRef}
      role={fullPage ? 'region' : 'dialog'}
      aria-modal={fullPage ? undefined : false}
      aria-labelledby="cg-title"
    >
      <header className="cg-head">
        <span className="cg-head-icon"><BotIcon /></span>
        <span className="cg-head-text">
          <h1 className="cg-title" id="cg-title">Cosmic Guide</h1>
          <p className="cg-sub">{context || (isIndonesian ? 'Asisten AI SPHEREx' : 'SPHEREx AI Assistant')}</p>
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
          <MicIcon />
        </button>
        {!fullPage && (
          <button type="button" className="cg-icon-btn cg-icon-btn--close" aria-label={isIndonesian ? 'Tutup' : 'Close'} onClick={close}>
            ×
          </button>
        )}
      </header>

      <div className="cg-thread" ref={threadRef} role="status" aria-live="polite">
        {messages.length === 0 ? (
          <p className="cg-empty" role="status">
            {isIndonesian
              ? context
                ? `Tanyakan sesuatu tentang ${context}.`
                : 'Ajukan pertanyaan tentang SPHEREx atau objek yang tersedia di katalog.'
              : context
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
        {loading && (
          <p className="cg-msg cg-msg--bot" style={{ opacity: 0.7, fontStyle: 'italic' }}>
            {isIndonesian ? 'Cosmic Guide sedang berpikir…' : 'Cosmic Guide is thinking…'}
          </p>
        )}
      </div>

      <div className="cg-chips">
        <button
          type="button"
          className="cg-chip"
          disabled={loading}
          onClick={() => handleChipClick('Apa misi utama dari teleskop SPHEREx?')}
        >
          {isIndonesian ? 'Misi SPHEREx' : 'SPHEREx Mission'}
        </button>
        <button
          type="button"
          className="cg-chip"
          disabled={loading}
          onClick={() => handleChipClick('Bagaimana SPHEREx mendeteksi air dan molekul es di ruang angkasa?')}
        >
          {isIndonesian ? 'Pencarian Air' : 'Water Ice Search'}
        </button>
        <button
          type="button"
          className="cg-chip"
          disabled={loading}
          onClick={() => handleChipClick('Apa keunggulan spektroskopi seluruh langit 102 pita inframerah?')}
        >
          {isIndonesian ? 'Spektroskopi Inframerah' : 'Infrared All-Sky'}
        </button>
      </div>

      <p className="cg-note">
        <span className="cg-note-tag">MISSION AGENT</span>
        {isIndonesian
          ? 'Jawaban memakai record katalog backend bila tersedia; data yang tidak tersedia tidak akan ditebak.'
          : 'Answers use backend catalog records when available; missing data is not guessed.'}
      </p>

      <form className="cg-form" onSubmit={submit}>
        <input
          ref={inputRef}
          className="cg-input"
          value={draft}
          disabled={loading}
          maxLength={500}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={isIndonesian ? 'Tulis pertanyaan ke Cosmic Guide…' : 'Ask Cosmic Guide a question…'}
          aria-label={isIndonesian ? 'Pertanyaan untuk Cosmic Guide' : 'Question for Cosmic Guide'}
        />
        <button type="submit" className="cg-send" disabled={!draft.trim() || loading} aria-label={isIndonesian ? 'Kirim' : 'Send'}>
          ↗
        </button>
      </form>
    </section>
  )

  return fullPage ? panel : createPortal(panel, document.body)
}
