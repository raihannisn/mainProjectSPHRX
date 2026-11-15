import { useCallback, useEffect, useRef, useState } from 'react'
import { requestVoiceTranscript } from '../api'

export type VoiceInputStatus = 'idle' | 'recording' | 'transcribing'

/** longest clip sent for transcription; recording stops by itself after this */
const MAX_RECORDING_MS = 30000
const RECORDER_TYPES = ['audio/webm', 'audio/mp4', 'audio/ogg']

interface RecognitionResult {
  0: { transcript: string }
}
interface RecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

function createRecognition(lang: 'en' | 'id'): RecognitionLike | null {
  const scope = window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike }
  const Ctor = scope.SpeechRecognition ?? scope.webkitSpeechRecognition
  if (!Ctor) return null
  try {
    const recognition = new Ctor()
    recognition.lang = lang === 'id' ? 'id-ID' : 'en-US'
    recognition.continuous = true
    recognition.interimResults = false
    return recognition
  } catch {
    return null
  }
}

export function voiceInputSupported() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'
}

/**
 * Push-to-talk for the Cosmic Guide: tap to record, tap again to send. The clip goes to the backend transcription
 * (/api/agent/voice/transcribe); the browser's own speech recognition listens at the same time and supplies the
 * text when the backend cannot (no key configured, offline). The microphone is released as soon as recording stops.
 */
export function useVoiceInput(lang: 'en' | 'id', onTranscript: (text: string) => void) {
  const [status, setStatus] = useState<VoiceInputStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const recognition = useRef<RecognitionLike | null>(null)
  const heard = useRef('')
  const timer = useRef<number | null>(null)
  const alive = useRef(true)
  const deliver = useRef(onTranscript)
  deliver.current = onTranscript

  const release = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
    stream.current?.getTracks().forEach((track) => track.stop())
    stream.current = null
    try {
      recognition.current?.stop()
    } catch {
      // already stopped
    }
  }, [])

  const stop = useCallback(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }, [])

  const start = useCallback(async () => {
    setError(null)
    if (!voiceInputSupported()) {
      setError('Voice input is not supported in this browser.')
      return
    }
    let media: MediaStream
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    } catch (cause: unknown) {
      const name = cause instanceof DOMException ? cause.name : ''
      setError(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Microphone access is blocked. Allow the microphone for this site, then try again.'
          : name === 'NotFoundError'
            ? 'No microphone was found on this device.'
            : 'The microphone could not be started.',
      )
      return
    }
    stream.current = media
    if (!alive.current) {
      release()
      return
    }

    const mimeType = RECORDER_TYPES.find((type) => MediaRecorder.isTypeSupported(type))
    const chunks: Blob[] = []
    const rec = new MediaRecorder(media, mimeType ? { mimeType } : undefined)
    recorder.current = rec
    rec.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    rec.onstop = () => {
      release()
      const type = (rec.mimeType || mimeType || 'audio/webm').split(';')[0]
      const clip = new Blob(chunks, { type })
      void (async () => {
        if (!alive.current) return
        setStatus('transcribing')
        let text = ''
        if (clip.size > 0) {
          const result = await requestVoiceTranscript(clip, lang)
          if (result.ok) text = result.data
        }
        // give the browser recogniser a moment to deliver its last result, then use it when the backend had none
        if (!text) {
          await new Promise((resolve) => window.setTimeout(resolve, 350))
          text = heard.current.trim()
        }
        if (!alive.current) return
        setStatus('idle')
        if (text) deliver.current(text)
        else setError('No speech was recognised. Tap the mic and try again.')
      })()
    }

    heard.current = ''
    recognition.current = createRecognition(lang)
    if (recognition.current) {
      recognition.current.onresult = (event) => {
        let text = ''
        for (let i = 0; i < event.results.length; i++) text += `${event.results[i][0].transcript} `
        heard.current = text
      }
      recognition.current.onerror = () => undefined
      try {
        recognition.current.start()
      } catch {
        recognition.current = null
      }
    }

    rec.start()
    setStatus('recording')
    timer.current = window.setTimeout(stop, MAX_RECORDING_MS)
  }, [lang, release, stop])

  const toggle = useCallback(() => {
    if (status === 'recording') stop()
    else if (status === 'idle') void start()
  }, [status, start, stop])

  /** drops the recording without sending it (window closed) */
  const cancel = useCallback(() => {
    const rec = recorder.current
    if (rec && rec.state === 'recording') {
      rec.onstop = null
      rec.stop()
    }
    release()
    setStatus('idle')
  }, [release])

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      const rec = recorder.current
      if (rec && rec.state === 'recording') {
        rec.onstop = null
        rec.stop()
      }
      release()
    }
  }, [release])

  return { status, error, toggle, cancel }
}
