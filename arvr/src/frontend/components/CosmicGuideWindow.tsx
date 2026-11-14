import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { ASK_GUIDE_EVENT } from '../../xr/events'
import type { GuideRequest } from '../../xr/types'
import { useXRApp } from '../../xr/store'
import { BotIcon } from '../guide/BotIcon'

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
  const [notice, setNotice] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const isIndonesian = lang === 'id'

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
      setNotice('')
      setOpen(true)
    }
    const openForXRRequest = (event: Event) => {
      const { body, hotspotId, guidePrompt } = (event as CustomEvent<GuideRequest>).detail
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setContext([body, hotspotId].filter(Boolean).join(' · '))
      setDraft(guidePrompt || '')
      setNotice('')
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

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft.trim()) return
    setNotice(
      isIndonesian
        ? 'API LLM eksternal belum terhubung. Pertanyaan belum dikirim.'
        : 'The external LLM API is not connected yet. Your question was not sent.',
    )
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
          <p className="cg-sub">{context || (isIndonesian ? 'Asisten eksplorasi' : 'Exploration assistant')}</p>
        </span>
        {!fullPage && (
          <button type="button" className="cg-icon-btn cg-icon-btn--close" aria-label={isIndonesian ? 'Tutup' : 'Close'} onClick={close}>
            ×
          </button>
        )}
      </header>

      <div className="cg-thread" role="status" aria-live="polite">
        <p className="cg-msg cg-msg--bot">
          {notice ||
            (isIndonesian
              ? 'Panel agent siap. Sambungan ke API LLM eksternal belum dikonfigurasi; tidak ada jawaban lokal yang dibuat.'
              : 'The agent panel is ready. The external LLM API is not configured; no local answers are generated.')}
        </p>
      </div>

      <p className="cg-note">
        <span className="cg-note-tag">{isIndonesian ? 'API EKSTERNAL' : 'EXTERNAL API'}</span>
        {isIndonesian ? 'Pertanyaan tidak dikirim sampai layanan LLM tersambung.' : 'Questions are not sent until the LLM service is connected.'}
      </p>

      <form className="cg-form" onSubmit={submit}>
        <input
          ref={inputRef}
          className="cg-input"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
            setNotice('')
          }}
          placeholder={isIndonesian ? 'Tulis pertanyaan…' : 'Write a question…'}
          aria-label={isIndonesian ? 'Pertanyaan untuk Cosmic Guide' : 'Question for Cosmic Guide'}
        />
        <button type="submit" className="cg-send" disabled={!draft.trim()} aria-label={isIndonesian ? 'Kirim' : 'Send'}>
          ↗
        </button>
      </form>
    </section>
  )

  return fullPage ? panel : createPortal(panel, document.body)
}
