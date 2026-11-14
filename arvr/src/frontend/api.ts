/**
 * SPHEREx API client. Requests use the same-origin /api routes, proxied to
 * FastAPI by Vite during development and routed to the API service in Vercel.
 */

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
  observed_at_utc?: string | null
  detector?: string
  effective_wavelength_at_target?: string
  bandwidth_at_target?: string
  preview_url: string
  fits_url: string
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
    const response = await fetch(path, { signal: AbortSignal.timeout(timeoutMs) })
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
      observed_at_utc: typeof item.observed_at_utc === 'string' ? item.observed_at_utc : null,
      detector: typeof item.detector === 'string' ? item.detector : undefined,
      effective_wavelength_at_target:
        typeof item.effective_wavelength_at_target === 'string' ? item.effective_wavelength_at_target : undefined,
      bandwidth_at_target: typeof item.bandwidth_at_target === 'string' ? item.bandwidth_at_target : undefined,
      preview_url: requiredString(item.preview_url, `observations[${index}].preview_url`),
      fits_url: requiredString(item.fits_url, `observations[${index}].fits_url`),
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

export function fetchObjectInfo(objectId: string) {
  return getJson(`/api/objects/${encodeURIComponent(objectId)}`, 6000, parseObjectInfo)
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

export function fetchApod() {
  return getJson('/api/nasa/apod', 20000, parseApod)
}
