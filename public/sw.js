/**
 * THE OFFLINE SHELL.
 *
 * This product has no server to fall back to — the record lives in IndexedDB on
 * the device — so being unable to reach the network should change nothing at
 * all. That is the whole ambition of this file, and it is deliberately small
 * enough to reason about in one sitting.
 *
 * Two strategies, chosen by what the request is:
 *
 *   HASHED BUILD ASSETS (/assets/*, fonts, icons) — cache first. Their names
 *   contain a content hash, so a cached one can never be stale: if the content
 *   changed, the name changed.
 *
 *   THE DOCUMENT (any navigation) — network first with a cache fallback, and
 *   every navigation resolves to the app shell because this is a single-page
 *   app. That means a deploy is picked up on the next online load rather than
 *   being pinned to whatever was cached first, and a route typed directly while
 *   offline still opens.
 *
 * WHAT IS NEVER CACHED HERE: the user's data. IndexedDB is the one canonical
 * store. Nothing in this file reads it, writes it, or keeps a second copy of it.
 */

// The cache name carries the build id passed on the registration URL
// (/sw.js?v=...), so a new build gets a new cache and the old one is deleted on
// activate. Without it the shell would be pinned to the first build ever seen.
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev'
const CACHE = `ambition-${VERSION}`

/** Enough to open the app with no network at all on a cold start. */
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // One failed optional file must not fail the whole install.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const isImmutable = (url) =>
  url.pathname.startsWith('/assets/') ||
  /\.(?:woff2?|png|svg|webmanifest)$/.test(url.pathname)

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          void caches.open(CACHE).then((cache) => cache.put('/', copy))
          return response
        })
        // Offline: every route resolves to the shell, and the router takes it
        // from there. A cached '/' is the app, not a stale copy of one page.
        .catch(() => caches.match('/').then((hit) => hit ?? Response.error())),
    )
    return
  }

  if (!isImmutable(url)) return

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            void caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})

// The page asks for an immediate takeover after it has told the person a new
// version is ready. Nothing is reloaded out from under anybody.
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') void self.skipWaiting()
})
