import type { GoalState } from '@/domain/types'

/**
 * THE MARKS
 *
 * Twenty-seven kanji, used as graphic marks and nothing else. See DESIGN.md 2
 * and 7.3.
 *
 * The contract, which is binding: every mark is rendered `aria-hidden` and is
 * always accompanied by its English string in the accessibility tree. A mark is
 * never a label, a button, an accessible name, or a status on its own. Delete
 * every kanji from this product and it must remain fully operable and fully
 * understood.
 *
 * `scripts/subset-marks.mjs` reads the `mark:` values out of this file to cut
 * the font, so the glyph set and the registry cannot drift apart.
 */

export interface Mark {
  /** The kanji. Decorative — always aria-hidden. */
  mark: string
  /** The name shown in the product, and what a screen reader is given. */
  name: string
}

/** Surfaces. The keys are the internal names; `name` is what a person sees. */
export const SURFACE = {
  warTable: { mark: '陣', name: 'THE WAR TABLE' },
  campaign: { mark: '戦', name: 'THE CAMPAIGN' },
  standard: { mark: '旗', name: 'A STANDARD' },
  detachment: { mark: '隊', name: 'A DETACHMENT' },
  siege: { mark: '城', name: 'A SIEGE' },
  gate: { mark: '門', name: 'A GATE' },
  dispatch: { mark: '報', name: 'A DISPATCH' },
  line: { mark: '線', name: 'THE LINE' },
  hour: { mark: '刻', name: 'THE HOUR' },
  dojo: { mark: '道場', name: 'THE DOJO' },
  shrine: { mark: '社', name: 'THE SHRINE' },
  chronicle: { mark: '記', name: 'THE CHRONICLE' },
  honours: { mark: '誉', name: 'HONOURS' },
  survey: { mark: '検', name: 'THE SURVEY' },
  rank: { mark: '位', name: 'RANK' },
  merit: { mark: '功', name: 'MERIT' },
  wind: { mark: '風', name: 'THE WIND' },
  unbroken: { mark: '連', name: 'THE UNBROKEN' },
  quartermaster: { mark: '具', name: 'THE QUARTERMASTER' },
  sealing: { mark: '印', name: 'THE SEALING' },
} as const satisfies Record<string, Mark>

export type SurfaceKey = keyof typeof SURFACE

/**
 * State marks. The English word is the real label; the kanji is the mark.
 * Note that none of these words is a judgement — see DESIGN.md 10.
 */
export const STATE_MARK: Record<GoalState, Mark> = {
  new: { mark: '新', name: 'PLANTED' },
  active: { mark: '動', name: 'STANDING' },
  critical: { mark: '危', name: 'THE HOUR' },
  stalled: { mark: '静', name: 'QUIET' },
  paused: { mark: '止', name: 'STRUCK' },
  completed: { mark: '了', name: 'TAKEN' },
}

/** Every glyph the subset font must contain. Used by the subset script's check. */
export const ALL_GLYPHS: string = [
  ...new Set([...Object.values(SURFACE), ...Object.values(STATE_MARK)].flatMap((m) => [...m.mark])),
].join('')

/**
 * Routes stay plain English so the URL bar is never a puzzle, even though the
 * surface they lead to has a name.
 */
export const ROUTE: Record<string, SurfaceKey> = {
  '/': 'warTable',
  '/campaign': 'campaign',
  '/dojo': 'dojo',
  '/shrine': 'shrine',
  '/chronicle': 'chronicle',
  '/honours': 'honours',
  '/survey': 'survey',
  '/quartermaster': 'quartermaster',
}
