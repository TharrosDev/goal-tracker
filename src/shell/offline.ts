/**
 * THE OFFLINE SHELL, from the page's side.
 *
 * This product already keeps everything on the device, so being offline should
 * be a non-event. The only thing standing between that and the truth was the
 * document and its assets, which came from a server. The worker in
 * `public/sw.js` fixes that; this file registers it and handles the one thing a
 * worker cannot decide for itself — when to hand somebody a new version.
 *
 * The rule: NEVER RELOAD UNDER SOMEBODY. A person mid-dispatch who is swapped
 * onto a new build loses what they were typing, which is a worse failure than
 * running yesterday's build for another minute. So a waiting worker is
 * announced, and it takes over when the person says so or on the next cold
 * start — whichever comes first.
 */

/**
 * The build this bundle came from, stamped onto the worker's URL.
 *
 * A service worker only updates when its BYTES change, and `sw.js` is a static
 * file that rarely does. Putting the build id in the query string makes each
 * deploy a genuinely different worker, which is also what names its cache — so
 * the old build's assets are dropped rather than shadowing the new ones.
 */
const BUILD = import.meta.env.MODE === 'production' ? __BUILD_ID__ : 'dev'

export interface UpdateState {
  /** A new version is downloaded and waiting for permission to take over. */
  waiting: boolean
  /** Take it, now. Reloads the page. */
  apply: () => void
}

type Listener = (state: UpdateState) => void

let waiting: ServiceWorker | null = null
const listeners = new Set<Listener>()

const apply = () => {
  if (!waiting) return
  waiting.postMessage('skip-waiting')
  // The controller change fires once the new worker has taken over; reloading
  // any earlier serves a mix of two builds.
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), {
    once: true,
  })
}

const announce = (worker: ServiceWorker) => {
  waiting = worker
  for (const listener of listeners) listener({ waiting: true, apply })
}

/** Subscribe to update news. Returns an unsubscribe. */
export function onUpdateReady(listener: Listener): () => void {
  listeners.add(listener)
  if (waiting) listener({ waiting: true, apply })
  return () => listeners.delete(listener)
}

export function registerOfflineShell(): void {
  if (!('serviceWorker' in navigator)) return
  // Vite's dev server serves modules the worker has no business caching, and a
  // stale worker in development is a debugging trap rather than a convenience.
  if (import.meta.env.DEV) return

  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(`/sw.js?v=${BUILD}`, { scope: '/' })
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller)
          announce(registration.waiting)

        registration.addEventListener('updatefound', () => {
          const next = registration.installing
          if (!next) return
          next.addEventListener('statechange', () => {
            // `controller` is null on the very first install — there is no old
            // version to replace, so there is nothing to announce.
            if (next.state === 'installed' && navigator.serviceWorker.controller) announce(next)
          })
        })
      })
      .catch(() => {
        // A refused registration (private window, unsupported scope, a policy)
        // costs nothing: the app has never needed the network to work.
      })
  })
}
