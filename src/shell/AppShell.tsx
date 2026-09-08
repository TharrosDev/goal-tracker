import { useCallback, useMemo, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { SURFACE, type SurfaceKey } from '@/design/marks'
import { useApplyWorld, useNarrow } from './prefs'
import { useHotkeys, type Binding } from './hotkeys'
import { Palette } from './Palette'
import { Dispatch } from './Dispatch'
import { Ceremony } from './Ceremony'
import './shell.css'

/**
 * THE CAMP. Rail on desktop, bottom navigation on a phone.
 *
 * The rail is the only place vertical setting is used: single short words, at or
 * above the 20px floor, and never a goal title — vertical Latin fits about nine
 * glyphs per column height, which is half what a title needs.
 */

/**
 * `short` is the vertical rail label and is capped at eight characters on
 * purpose: upright Latin costs about one em of column height per glyph, so a
 * longer string either wraps into a second column and interleaves into
 * gibberish, or drops under the 20px legibility floor. The full name is still
 * the accessible name and the tooltip.
 */
const DESTINATIONS: { to: string; key: SurfaceKey; short: string; hotkey: string }[] = [
  { to: '/', key: 'warTable', short: 'WAR', hotkey: 'H' },
  { to: '/campaign', key: 'campaign', short: 'FIELD', hotkey: 'G' },
  { to: '/dojo', key: 'dojo', short: 'DOJO', hotkey: 'F' },
  { to: '/shrine', key: 'shrine', short: 'SHRINE', hotkey: 'S' },
  { to: '/chronicle', key: 'chronicle', short: 'RECORD', hotkey: 'T' },
  { to: '/honours', key: 'honours', short: 'HONOURS', hotkey: 'A' },
]

/** The phone carries five, thumb-reachable, with planting in the middle. */
const MOBILE = ['/', '/campaign', '/plant', '/dojo', '/chronicle'] as const

export function AppShell() {
  useApplyWorld()
  const narrow = useNarrow()
  const navigate = useNavigate()
  const [overlay, setOverlay] = useState<'none' | 'palette' | 'dispatch'>('none')
  const close = useCallback(() => setOverlay('none'), [])

  /**
   * Every command is a single key, and every one of them is also reachable by
   * pointer. Escape always closes whatever is open — it is the way out, so it
   * works even while typing.
   */
  const bindings = useMemo<Binding[]>(
    () => [
      ...DESTINATIONS.map((d) => ({
        key: d.hotkey.toLowerCase(),
        label: SURFACE[d.key].name,
        run: () => navigate(d.to),
      })),
      { key: 'n', label: 'Plant a standard', run: () => navigate('/plant') },
      { key: 'q', label: 'Log a dispatch', run: () => setOverlay('dispatch') },
      { key: '/', label: 'Order book', run: () => setOverlay('palette') },
      { key: 'k', meta: true, label: 'Order book', run: () => setOverlay('palette') },
      { key: 'escape', label: 'Close', run: close },
    ],
    [navigate, close],
  )
  useHotkeys(bindings)

  return (
    <div className="camp">
      <a className="skip" href="#field">
        Skip to the field
      </a>
      <div className="ambient" aria-hidden="true" />

      {!narrow && (
        <nav className="rail" aria-label="Camp">
          <ul>
            {DESTINATIONS.map(({ to, key, short, hotkey }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  className="rail__link"
                  title={`${SURFACE[key].name} (${hotkey})`}
                >
                  <span className="rail__mark" aria-hidden="true">
                    {SURFACE[key].mark}
                  </span>
                  <span className="rail__name" aria-hidden="true">
                    {short}
                  </span>
                  <span className="sr-only">{SURFACE[key].name}</span>
                </NavLink>
              </li>
            ))}
          </ul>
          <NavLink
            to="/quartermaster"
            className="rail__link rail__link--foot"
            title={SURFACE.quartermaster.name}
          >
            <span className="rail__mark" aria-hidden="true">
              {SURFACE.quartermaster.mark}
            </span>
            <span className="rail__name" aria-hidden="true">
              SUPPLY
            </span>
            <span className="sr-only">{SURFACE.quartermaster.name}</span>
          </NavLink>
        </nav>
      )}

      <main className="camp__main" id="field">
        <Outlet />
      </main>

      <Palette open={overlay === 'palette'} onClose={close} />
      <Dispatch open={overlay === 'dispatch'} onClose={close} onLogged={() => {}} />
      <Ceremony />

      {narrow && (
        <nav className="tabs" aria-label="Camp">
          {MOBILE.map((to) => {
            const plant = to === '/plant'
            const key = plant ? null : DESTINATIONS.find((d) => d.to === to)?.key
            return (
              <NavLink key={to} to={to} end={to === '/'} className="tabs__link">
                <span className="tabs__mark" aria-hidden="true">
                  {plant ? '＋' : key ? SURFACE[key].mark : ''}
                </span>
                <span className="tabs__name">{plant ? 'PLANT' : key ? SURFACE[key].name : ''}</span>
              </NavLink>
            )
          })}
        </nav>
      )}
    </div>
  )
}
