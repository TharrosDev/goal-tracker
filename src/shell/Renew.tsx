import { useEffect, useState } from 'react'
import { onUpdateReady } from './offline'

/**
 * A NEW VERSION IS READY.
 *
 * Shown only when a new build has already downloaded and is waiting — never as
 * a nag, never on a timer, and never as a modal. The person is mid-something;
 * the new version can wait for them, and if they ignore this it takes over on
 * the next cold start anyway.
 */
export function Renew() {
  const [ready, setReady] = useState<null | (() => void)>(null)

  useEffect(() => onUpdateReady((state) => setReady(() => state.apply)), [])

  if (!ready) return null

  return (
    <div className="renew" role="status">
      <span className="renew__line">A newer camp is ready.</span>
      <button type="button" className="renew__go" onClick={ready}>
        TAKE IT
      </button>
      <button
        type="button"
        className="renew__dismiss"
        onClick={() => setReady(null)}
        aria-label="Not now"
      >
        ×
      </button>
    </div>
  )
}
