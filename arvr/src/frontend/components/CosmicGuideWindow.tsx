import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ASK_GUIDE_EVENT } from '../../xr/events'
import type { GuideRequest } from '../../xr/types'
import { useXRApp } from '../../xr/store'
import { BotIcon } from '../guide/BotIcon'
import { useGuide } from '../guide/guideStore'

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

  const { messages, loading, sendMessage } = useGuide()

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
      setDraft('')
      setOpen(true)
    }
    const openForXRRequest = (event: Event) => {
      const { body, hotspotId, guidePrompt } = (event as CustomEvent<GuideRequest>).detail
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setContext([body, hotspotId].filter(Boolean).join(' · '))
      setDraft(guidePrompt || '')
      setOpen(true)
    }

    window.addEventListener('cosmic:open-guide', openGuide)
    window.addEventListener(ASK_GUIDE_EVENT, openForXRRequest)
    return () => {
      window.removeEventListener('cosmic:open-guide', openGuide)
      window.removeEventListener(ASK_GUIDE_EVENT, openForXRRequest)
    }
  }, [fullPage])

  useEffect(() => {
    if (!fullPage) setContext(initialObjectId ?? '')
  }, [fullPage, initialObjectId])

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
    await sendMessage(context ? `[Konteks: ${context}] ${text}` : text)
  }

  const handleChipClick = (chipText: string) => {
    sendMessage(context ? `[Konteks: ${context}] ${chipText}` : chipText)
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
        {!fullPage && (
          <button type="button" className="cg-icon-btn cg-icon-btn--close" aria-label={isIndonesian ? 'Tutup' : 'Close'} onClick={close}>
            ×
          </button>
        )}
      </header>

      <div className="cg-thread" ref={threadRef} role="status" aria-live="polite">
        {messages.length === 0 ? (
          <div className="cg-msg cg-msg--bot cg-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {isIndonesian
                ? 'Halo Explorer! Saya **Cosmic Guide AI** bertenaga Gemini 3.5 Flash. Tanyakan apa saja seputar pengamatan SPHEREx, peta langit inframerah, atau objek tata surya!'
                : 'Hello Explorer! I am **Cosmic Guide AI** powered by Gemini 3.5 Flash. Ask me anything about SPHEREx observations, infrared sky maps, or solar system targets!'}
            </ReactMarkdown>
          </div>
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
          onClick={() => handleChipClick('Apa misi utama dari teleskop SPHEREx?')}
        >
          {isIndonesian ? 'Misi SPHEREx' : 'SPHEREx Mission'}
        </button>
        <button
          type="button"
          className="cg-chip"
          onClick={() => handleChipClick('Bagaimana SPHEREx mendeteksi air dan molekul es di ruang angkasa?')}
        >
          {isIndonesian ? 'Pencarian Air' : 'Water Ice Search'}
        </button>
        <button
          type="button"
          className="cg-chip"
          onClick={() => handleChipClick('Apa keunggulan spektroskopi seluruh langit 102 pita inframerah?')}
        >
          {isIndonesian ? 'Spektroskopi Inframerah' : 'Infrared All-Sky'}
        </button>
      </div>

      <p className="cg-note">
        <span className="cg-note-tag">GEMINI 3.5</span>
        {isIndonesian ? 'Terhubung langsung ke backend SPHEREx API' : 'Connected directly to SPHEREx API backend'}
      </p>

      <form className="cg-form" onSubmit={submit}>
        <input
          ref={inputRef}
          className="cg-input"
          value={draft}
          disabled={loading}
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
