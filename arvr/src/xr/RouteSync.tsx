import { useEffect, useRef } from 'react'
import { matchPath, useLocation, useNavigate } from 'react-router-dom'
import { useXRApp, getCachedObservation, cacheObservations } from './store'
import { loadSiteContent } from './content'
import { fetchObjectInfo, searchSpherexObservations } from '../frontend/api'

/**
 * Two-way sync between the URL and the shared store so the web viewer can deep-link:
 *   /xr                        → Solar System hub
 *   /xr/body/:id?target=…&obs=…&obs2=…&band=… → body explorer (preserves observations & band)
 *   /xr/surface/:siteId        → stand on the surface (content/sites/<siteId>.json)
 */
export function RouteSync() {
  const loc = useLocation()
  const navigate = useNavigate()
  const bodyId = useXRApp((s) => s.bodyId)
  const siteId = useXRApp((s) => s.siteId)
  const ready = useRef(false)
  const requestGenRef = useRef(0)

  // URL → store
  useEffect(() => {
    if (!loc.pathname.startsWith('/xr')) {
      ready.current = false
      return
    }
    const body = matchPath('/xr/body/:id', loc.pathname)
    const surface = matchPath('/xr/surface/:siteId', loc.pathname)
    const sp = new URLSearchParams(loc.search)
    const s = useXRApp.getState()
    const sid = surface?.params.siteId

    let cancelled = false
    const currentGen = ++requestGenRef.current

    if (sid) {
      if (s.siteId !== sid) {
        s.selectSite(sid, s.bodyId ?? '')
        loadSiteContent(sid).then((site) => {
          if (!cancelled && requestGenRef.current === currentGen && site && useXRApp.getState().siteId === sid) {
            useXRApp.setState({ bodyId: site.body })
          }
        })
      }
    } else {
      s.selectBody(body?.params.id ?? null)
    }

    const target = sp.get('target')
    const obs = sp.get('obs')
    const obs2 = sp.get('obs2')
    const band = sp.get('band')

    s.setTarget(target)
    s.setBand(band)
    s.setObservation(obs)
    s.setObservationB(obs2)

    // Resolve observation metadata if obs is present
    if (obs) {
      const cachedA = getCachedObservation(obs)
      const cachedB = obs2 ? getCachedObservation(obs2) : null

      // Set immediately whatever is known from cache (avoids showing metadata from an earlier observation)
      s.setObservationData(cachedA ?? null, cachedB ?? null)

      // Fetch from catalog & SIA2 backend if either required observation is not in cache
      if (!cachedA || (obs2 && !cachedB)) {
        const targetQuery = target || 'rcw-36'
        if (targetQuery === 'rcw-36') {
          fetchObjectInfo('rcw-36')
            .then((objRes) => {
              if (cancelled || requestGenRef.current !== currentGen) return null
              if (objRes.ok && objRes.data.ra !== undefined && objRes.data.dec !== undefined) {
                return searchSpherexObservations(objRes.data.ra, objRes.data.dec)
              }
              return null
            })
            .then((obsRes) => {
              if (cancelled || requestGenRef.current !== currentGen || !obsRes) return
              const currentStore = useXRApp.getState()
              // Strict validation: verify route parameters still match active store before applying
              if (
                currentStore.observation !== obs ||
                currentStore.observationB !== (obs2 ?? null) ||
                currentStore.target !== target
              ) {
                return
              }
              if (obsRes.ok && Array.isArray(obsRes.data.observations)) {
                cacheObservations(obsRes.data.observations)
                const resolvedA = obsRes.data.observations.find((item) => item.observation_id === obs) ?? null
                const resolvedB = obs2
                  ? obsRes.data.observations.find((item) => item.observation_id === obs2) ?? null
                  : null
                currentStore.setObservationData(resolvedA, resolvedB)
              } else {
                // Explicitly preserve cached values or null
                currentStore.setObservationData(cachedA ?? null, cachedB ?? null)
              }
            })
            .catch(() => {
              if (cancelled || requestGenRef.current !== currentGen) return
              const currentStore = useXRApp.getState()
              if (
                currentStore.observation !== obs ||
                currentStore.observationB !== (obs2 ?? null) ||
                currentStore.target !== target
              ) {
                return
              }
              currentStore.setObservationData(cachedA ?? null, cachedB ?? null)
            })
        }
      }
    } else {
      s.clearObservations()
    }

    ready.current = true
    return () => {
      cancelled = true
    }
  }, [loc.pathname, loc.search, navigate])

  // store → URL (e.g. picking a body inside VR).
  useEffect(() => {
    if (!ready.current) return
    if (!loc.pathname.startsWith('/xr')) return
    const { bodyId: id, siteId: site } = useXRApp.getState()
    const target = site ? `/xr/surface/${encodeURIComponent(site)}` : id ? `/xr/body/${encodeURIComponent(id)}` : '/xr'
    if (loc.pathname !== target) navigate(target + loc.search)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyId, siteId])

  return null
}
