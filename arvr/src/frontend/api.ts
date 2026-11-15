/**
 * SPHEREx API client. Requests use the same-origin /api routes, proxied to
 * FastAPI by Vite during development and routed to the API service in Vercel.
 */

export const BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
  (import.meta.env.DEV ? '' : 'https://nasa-spherex-backend.vercel.app')

export const API_URL = BASE_URL

export function toApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const base = BASE_URL.replace(/\/+$/, '')
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${cleanPath}`
}

export interface SystemStatus {
  status: string
  data_source?: string
  engine?: string
  capabilities?: string[]
  message?: string
}

export interface FitsMetadata {
  telescope: string
  observation_date: string
  right_ascension: string
  declination: string
  data_source: string
  status: string
}

export interface ObjectInfo {
  id?: string
  name: string
  type: string
  description: string
  ra?: number
  dec?: number
  ra_hms?: string
  dec_dms?: string
  source?: string
}

export interface SpherexObservation {
  observation_id: string
  release?: string
  release_doi?: string
  collection?: string
  processing_version?: string
  calib_level?: number
  detector?: string
  observed_at_utc?: string | null
  effective_wavelength_at_target?: string
  bandwidth_at_target?: string
  visualization_wavelength?: string
  visualization_bandwidth?: string
  spectral_calibration_source?: string
  quality_flag?: number | string | null
  quality_flag_meaning?: string | null
  provenance_badge?: string
  preview_url: string
  fits_url: string
  cutout_fits_url?: string
}

export interface SpherexObservationsResponse {
  query: {
    ra: number
    dec: number
    radius: number
    collection?: string
    start_date?: string | null
    end_date?: string | null
    detector?: string | null
  }
  source: string
  total_results: number
  observations: SpherexObservation[]
}

export interface ApodData {
  status: 'ok' | 'error'
  fallback: boolean
  message?: string | null
  title?: string | null
  date?: string | null
  explanation?: string | null
  media_type?: string
  image_url?: string | null
  thumbnail_url?: string | null
  article_url?: string | null
  alt?: string | null
  credit?: string | null
  copyright?: string | null
}

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }
type Parser<T> = (value: unknown) => T

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Invalid API response: ${field} is missing`)
  return value
}

function requiredNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid API response: ${field} is missing`)
  return value
}

async function getJson<T>(path: string, timeoutMs: number, parse: Parser<T>): Promise<ApiResult<T>> {
  try {
    const fullUrl = toApiUrl(path)
    const response = await fetch(fullUrl, { signal: AbortSignal.timeout(timeoutMs) })
    if (!response.ok) {
      let detail = ''
      try {
        const body: unknown = await response.json()
        if (isRecord(body) && typeof body.detail === 'string') detail = `: ${body.detail}`
      } catch {
        // The HTTP status remains useful when the error body is not JSON.
      }
      throw new Error(`HTTP ${response.status}${detail}`)
    }
    return { ok: true, data: parse(await response.json()) }
  } catch (error: unknown) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function parseSystemStatus(value: unknown): SystemStatus {
  if (!isRecord(value)) throw new Error('Invalid API response: expected status object')
  return {
    status: requiredString(value.status, 'status'),
    data_source: typeof value.data_source === 'string' ? value.data_source : undefined,
    engine: typeof value.engine === 'string' ? value.engine : undefined,
    capabilities: Array.isArray(value.capabilities)
      ? value.capabilities.filter((item): item is string => typeof item === 'string')
      : undefined,
    message: typeof value.message === 'string' ? value.message : undefined,
  }
}

function parseFitsMetadata(value: unknown): FitsMetadata {
  if (!isRecord(value)) throw new Error('Invalid API response: expected FITS metadata object')
  return {
    telescope: requiredString(value.telescope, 'telescope'),
    observation_date: requiredString(value.observation_date, 'observation_date'),
    right_ascension: requiredString(value.right_ascension, 'right_ascension'),
    declination: requiredString(value.declination, 'declination'),
    data_source: requiredString(value.data_source, 'data_source'),
    status: requiredString(value.status, 'status'),
  }
}

function parseObjectInfo(value: unknown): ObjectInfo {
  if (!isRecord(value)) throw new Error('Invalid API response: expected object catalog entry')
  return {
    id: typeof value.id === 'string' ? value.id : undefined,
    name: requiredString(value.name, 'name'),
    type: requiredString(value.type, 'type'),
    description: requiredString(value.description, 'description'),
    ra: typeof value.ra === 'number' && Number.isFinite(value.ra) ? value.ra : undefined,
    dec: typeof value.dec === 'number' && Number.isFinite(value.dec) ? value.dec : undefined,
    ra_hms: typeof value.ra_hms === 'string' ? value.ra_hms : undefined,
    dec_dms: typeof value.dec_dms === 'string' ? value.dec_dms : undefined,
    source: typeof value.source === 'string' ? value.source : undefined,
  }
}

function parseObservations(value: unknown): SpherexObservationsResponse {
  if (!isRecord(value) || !isRecord(value.query) || !Array.isArray(value.observations)) {
    throw new Error('Invalid API response: expected SPHEREx observations')
  }
  const observations = value.observations.map((item, index): SpherexObservation => {
    if (!isRecord(item)) throw new Error(`Invalid API response: observation ${index + 1} is not an object`)
    return {
      observation_id: requiredString(item.observation_id, `observations[${index}].observation_id`),
      release: typeof item.release === 'string' ? item.release : undefined,
      release_doi: typeof item.release_doi === 'string' ? item.release_doi : undefined,
      collection: typeof item.collection === 'string' ? item.collection : undefined,
      processing_version: typeof item.processing_version === 'string' ? item.processing_version : undefined,
      calib_level: typeof item.calib_level === 'number' ? item.calib_level : undefined,
      detector: typeof item.detector === 'string' ? item.detector : undefined,
      observed_at_utc: typeof item.observed_at_utc === 'string' ? item.observed_at_utc : null,
      effective_wavelength_at_target:
        typeof item.effective_wavelength_at_target === 'string' ? item.effective_wavelength_at_target : undefined,
      bandwidth_at_target: typeof item.bandwidth_at_target === 'string' ? item.bandwidth_at_target : undefined,
      visualization_wavelength:
        typeof item.visualization_wavelength === 'string' ? item.visualization_wavelength : undefined,
      visualization_bandwidth:
        typeof item.visualization_bandwidth === 'string' ? item.visualization_bandwidth : undefined,
      spectral_calibration_source:
        typeof item.spectral_calibration_source === 'string' ? item.spectral_calibration_source : undefined,
      quality_flag:
        typeof item.quality_flag === 'number' || typeof item.quality_flag === 'string' ? item.quality_flag : null,
      quality_flag_meaning: typeof item.quality_flag_meaning === 'string' ? item.quality_flag_meaning : null,
      provenance_badge: typeof item.provenance_badge === 'string' ? item.provenance_badge : undefined,
      preview_url: requiredString(item.preview_url, `observations[${index}].preview_url`),
      fits_url: requiredString(item.fits_url, `observations[${index}].fits_url`),
      cutout_fits_url: typeof item.cutout_fits_url === 'string' ? item.cutout_fits_url : undefined,
    }
  })
  const totalResults = value.total_results ?? value.total_products
  if (typeof totalResults !== 'number' || !Number.isFinite(totalResults)) {
    throw new Error('Invalid API response: total_results is missing')
  }
  return {
    query: {
      ra: requiredNumber(value.query.ra, 'query.ra'),
      dec: requiredNumber(value.query.dec, 'query.dec'),
      radius: requiredNumber(value.query.radius, 'query.radius'),
      collection: typeof value.query.collection === 'string' ? value.query.collection : undefined,
      start_date: typeof value.query.start_date === 'string' ? value.query.start_date : null,
      end_date: typeof value.query.end_date === 'string' ? value.query.end_date : null,
      detector: typeof value.query.detector === 'string' ? value.query.detector : null,
    },
    source: requiredString(value.source, 'source'),
    total_results: totalResults,
    observations,
  }
}

function parseApod(value: unknown): ApodData {
  if (!isRecord(value) || (value.status !== 'ok' && value.status !== 'error')) {
    throw new Error('Invalid API response: expected NASA APOD data')
  }
  return {
    status: value.status,
    fallback: value.fallback === true,
    message: typeof value.message === 'string' ? value.message : null,
    title: typeof value.title === 'string' ? value.title : null,
    date: typeof value.date === 'string' ? value.date : null,
    explanation: typeof value.explanation === 'string' ? value.explanation : null,
    media_type: typeof value.media_type === 'string' ? value.media_type : undefined,
    image_url: typeof value.image_url === 'string' ? value.image_url : null,
    thumbnail_url: typeof value.thumbnail_url === 'string' ? value.thumbnail_url : null,
    article_url: typeof value.article_url === 'string' ? value.article_url : null,
    alt: typeof value.alt === 'string' ? value.alt : null,
    credit: typeof value.credit === 'string' ? value.credit : null,
    copyright: typeof value.copyright === 'string' ? value.copyright : null,
  }
}

export function fetchSystemStatus() {
  return getJson('/api/status', 6000, parseSystemStatus)
}

export function fetchFitsMetadata() {
  return getJson('/api/metadata/fits', 6000, parseFitsMetadata)
}

export const DEFAULT_RCW36_INFO: ObjectInfo = {
  id: 'rcw-36',
  name: 'RCW 36 Emission Nebula',
  type: 'Emission Nebula / H II Region',
  description:
    'A compact star-forming H II emission nebula situated within Cloud C of the Vela Molecular Ridge. Ionized by massive embedded O/B stars and observed by SPHEREx across 96 infrared spectral channels.',
  ra: 134.8708,
  dec: -43.7533,
  ra_hms: '08h 59m 29s',
  dec_dms: '-43°45′12″',
  source: 'IPAC IRSA SPHEREx QR3 Catalog',
}

export function fetchBackendObjectInfo(objectId: string): Promise<ApiResult<ObjectInfo>> {
  return getJson(`/api/objects/${encodeURIComponent(objectId)}`, 6000, parseObjectInfo)
}

export async function fetchObjectInfo(objectId: string): Promise<ApiResult<ObjectInfo>> {
  const result = await fetchBackendObjectInfo(objectId)
  if (result.ok) return result
  if (objectId.toLowerCase() === 'rcw-36' || objectId.toLowerCase() === 'rcw') {
    return { ok: true, data: DEFAULT_RCW36_INFO }
  }
  return result
}

export function searchSpherexObservations(ra: number, dec: number, radius = 0.05) {
  if (!Number.isFinite(ra) || !Number.isFinite(dec) || !Number.isFinite(radius)) {
    return Promise.resolve({ ok: false as const, error: 'RA, Dec, and radius must be finite numbers.' })
  }
  const params = new URLSearchParams({
    ra: String(ra),
    dec: String(dec),
    radius: String(radius),
    collection: 'all',
  })
  return getJson(`/api/spherex/observations?${params}`, 40000, parseObservations)
}

export const OFFLINE_APOD_DATA: ApodData = {
  status: 'ok',
  fallback: true,
  message: 'NASA APOD sedang berjalan dalam mode offline.',
  title: 'NASA APOD - Offline Mode',
  date: '2026-11-15',
  explanation:
    'Layanan live NASA APOD saat ini sedang tidak dapat dijangkau dari server upstream (NASA Error 500). Sebagai gantinya, ditampilkan arsip observasi astronomi spektakuler Vela Molecular Ridge Nebula dari teleskop ruang angkasa SPHEREx dalam spektrum inframerah.',
  media_type: 'image',
  image_url: '/spherex/vela.jpg',
  thumbnail_url: '/spherex/vela.jpg',
  article_url: 'https://science.nasa.gov',
  alt: 'Vela Molecular Ridge Nebula captured in infrared by SPHEREx',
  credit: 'NASA / JPL-Caltech / SPHEREx Science Team',
  copyright: 'NASA / JPL-Caltech',
}

export const APOD_FALLBACK_ERROR = 'NASA APOD sedang tidak tersedia. Silakan coba lagi.'

export async function fetchApod(): Promise<ApiResult<ApodData>> {
  const primaryUrl = toApiUrl('/api/nasa/apod')
  try {
    const response = await fetch(primaryUrl, { signal: AbortSignal.timeout(12000) })
    if (response.ok) {
      const body: unknown = await response.json()
      const data = parseApod(body)
      if (data.status === 'ok') {
        return { ok: true, data }
      }
      if (data.fallback && (data.title || data.image_url)) {
        return { ok: true, data }
      }
    }
  } catch {
    // Primary fetch failed (e.g. local backend not running on port 8000)
  }

  // If local dev environment failed to reach 127.0.0.1:8000, attempt failover to production backend
  if (primaryUrl.includes('127.0.0.1') || primaryUrl.includes('localhost')) {
    try {
      const fallbackUrl = 'https://nasa-spherex-backend.vercel.app/api/nasa/apod'
      const fbResponse = await fetch(fallbackUrl, { signal: AbortSignal.timeout(12000) })
      if (fbResponse.ok) {
        const fbBody: unknown = await fbResponse.json()
        const fbData = parseApod(fbBody)
        if (fbData.status === 'ok') {
          return { ok: true, data: fbData }
        }
      }
    } catch {
      // Production failover also failed or timed out
    }
  }

  // Return prepared offline dummy data
  return { ok: true, data: OFFLINE_APOD_DATA }
}

/* ------------------------------------------------------------------ *
 * Cosmic Guide (floating chat)
 *
 * The guide is intentionally knowledge-free in the client: answers come from
 * an external LLM service. Until that service is provisioned the UI reports it
 * honestly instead of inventing an answer.
 * ------------------------------------------------------------------ */

export interface GuideReplyRequest {
  objectId: string
  objectName: string
  question: string
  lang: 'en' | 'id'
}

export type GuideReply = { ok: true; text: string } | { ok: false; error: string }

export interface AgentChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function requestAgentChat(
  messages: AgentChatMessage[],
  objectId: string | undefined,
  lang: 'en' | 'id',
): Promise<GuideReply> {
  try {
    const response = await fetch(toApiUrl('/api/agent/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        objectId,
        lang,
        messages: messages.slice(-10).map((message) => ({
          role: message.role === 'assistant' ? 'bot' : 'user',
          content: message.content,
        })),
      }),
      signal: AbortSignal.timeout(45000),
    })

    if (!response.ok) {
      let detail = `HTTP ${response.status}`
      try {
        const body: unknown = await response.json()
        if (isRecord(body) && typeof body.detail === 'string') detail += `: ${body.detail}`
      } catch {
        // Keep the HTTP status when the error body is not JSON.
      }
      return { ok: false, error: detail }
    }

    const body: unknown = await response.json()
    if (isRecord(body) && body.success === true && isRecord(body.data)) {
      const answer = body.data.message
      if (typeof answer === 'string' && answer.trim()) {
        return { ok: true, text: answer.trim() }
      }
    }
    return { ok: false, error: 'The Agent returned an invalid or empty response.' }
  } catch (error: unknown) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function requestGuideReply(payload: GuideReplyRequest): Promise<GuideReply> {
  return requestAgentChat(
    [{ role: 'user', content: payload.question }],
    payload.objectId,
    payload.lang,
  )
}

export async function requestAgentSpeech(
  text: string,
  language: 'en' | 'id',
): Promise<ApiResult<Blob>> {
  try {
    const response = await fetch(toApiUrl('/api/agent/voiceover/text'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language, voicePreset: 'mission-liaison' }),
      signal: AbortSignal.timeout(45000),
    })

    if (!response.ok) {
      let detail = `HTTP ${response.status}`
      try {
        const body: unknown = await response.json()
        if (isRecord(body) && typeof body.detail === 'string') detail += `: ${body.detail}`
      } catch {
        // Keep the HTTP status when the error body is not JSON.
      }
      return { ok: false, error: detail }
    }

    const audio = await response.blob()
    if (audio.size === 0 || !audio.type.includes('audio')) {
      return { ok: false, error: 'The Agent returned an invalid audio response.' }
    }
    return { ok: true, data: audio }
  } catch (error: unknown) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

