import { SURFACE, type SurfaceKey } from '@/design/marks'
import './holding.css'

/**
 * A surface that exists in the specification and has not been built yet.
 *
 * Deliberately not a placeholder screen pretending to be finished: it names the
 * surface, says plainly that it is not built, and does not fake any data. Every
 * one of these is deleted as its surface lands.
 */
export function Holding({ surface }: { surface: SurfaceKey }) {
  const { mark, name } = SURFACE[surface]
  return (
    <div className="holding">
      <span className="holding__mark" aria-hidden="true">
        {mark}
      </span>
      <h1 className="h1">{name}</h1>
      <p className="lede">Specified, not yet built. Nothing here is a mock.</p>
    </div>
  )
}
