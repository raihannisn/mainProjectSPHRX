/* AR Cosmic Expedition: offline support (scoped to /xr/).
 * - Pages: network first (so a new deploy shows up), falling back to the saved copy when offline.
 * - Everything else under /xr/ (code, models, textures, terrain, fonts): saved the first time it
 *   is used, then served from the device — so places you've visited keep working if the Wi-Fi drops.
 * - "Save for offline" asks this worker to download the whole list in /xr/offline-manifest.json up front.
 * - Requests outside /xr/ (the main frontend at /, and /api/*) are NEVER intercepted: this worker
 *   must not cache or serve anything belonging to the SPHEREx web frontend or the FastAPI backend.
 */
const CACHE_NAMESPACE = 'cosmic-offline-'
const CACHE = 'cosmic-offline-v1'
const SCOPE_PATH = '/xr/'
const XR_ENTRY = '/xr/index.html'

/** True when a request URL belongs to the XR application. */
function isXrPath(url) {
  return url.pathname === SCOPE_PATH.replace(/\/$/, '') || url.pathname.startsWith(SCOPE_PATH)
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([XR_ENTRY])).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith(CACHE_NAMESPACE) && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // Only ever touch XR paths. Never intercept the main frontend (/, /explorer, ...)
  // or backend API calls (/api/*) — pass those straight through to the network.
  if (!isXrPath(url)) return
  if (url.pathname === SCOPE_PATH + 'sw.js' || url.pathname === SCOPE_PATH + 'offline-manifest.json') return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(XR_ENTRY, copy))
          return res
        })
        .catch(() => caches.match(XR_ENTRY)),
    )
    return
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic' && !req.headers.has('range')) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        }),
    ),
  )
})

// "Save for offline": download every file in the manifest, reporting progress to the page.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'precache') return
  const port = event.ports[0]
  event.waitUntil(
    (async () => {
      try {
        const list = await (await fetch(SCOPE_PATH + 'offline-manifest.json', { cache: 'no-store' })).json()
        const cache = await caches.open(CACHE)
        let done = 0
        const queue = [...list.files]
        const worker = async () => {
          while (queue.length) {
            const f = queue.shift()
            if (!(await cache.match(f))) {
              try {
                const res = await fetch(f)
                if (res.ok) await cache.put(f, res)
              } catch {
                /* keep going; a later visit fills gaps */
              }
            }
            done++
            port?.postMessage({ done, total: list.files.length })
          }
        }
        await Promise.all([worker(), worker(), worker(), worker()])
        port?.postMessage({ done: list.files.length, total: list.files.length, finished: true })
      } catch (e) {
        port?.postMessage({ error: String(e) })
      }
    })(),
  )
})
