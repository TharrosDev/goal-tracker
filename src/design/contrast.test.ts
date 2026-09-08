import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * THE BINDING RULE, ENFORCED (DESIGN.md 4.1).
 *
 * Every value the interface encodes clears 3:1 against what it sits on, and
 * every piece of text clears 4.5:1 — in all five camps.
 *
 * This test exists because it is the exact failure that killed the first four
 * art directions: each had a beautiful signature encoding — lacquer relief,
 * lamellar plates filling, goal-hue at 14% over near-black — that computed
 * between 1.07:1 and 1.35:1 and simply could not be seen. Material depth is a
 * richness layer. It may enrich a channel; it may never be the only carrier.
 *
 * tokens.css is the single source of truth and this test parses it, so the two
 * cannot drift apart.
 */

// Read from disk rather than imported: the CSS file is the single source of
// truth, and parsing it is what stops this test and the tokens drifting apart.
const CSS = readFileSync(resolve(process.cwd(), 'src/design/tokens.css'), 'utf8')

/** Every `[data-world='x'] { … }` block, plus the `:root` default. */
function parseCamps(css: string): Map<string, Map<string, string>> {
  const camps = new Map<string, Map<string, string>>()
  // Strip comments first so a hex inside prose is never mistaken for a value.
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const blocks = clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)
  for (const [, selectorRaw, body] of blocks) {
    const names = (selectorRaw ?? '')
      .split(',')
      .map((s) => s.trim())
      .map((s) => s.match(/\[data-world='([a-z]+)'\]/)?.[1])
      .filter((s): s is string => Boolean(s))
    if (!names.length) continue
    const props = new Map<string, string>()
    for (const [, prop, value] of (body ?? '').matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g))
      props.set(prop!.trim(), value!.trim())
    for (const name of names) {
      const existing = camps.get(name) ?? new Map<string, string>()
      for (const [k, v] of props) existing.set(k, v)
      camps.set(name, existing)
    }
  }
  return camps
}

type RGBA = { r: number; g: number; b: number; a: number }

function parseColour(value: string): RGBA | null {
  const hex = value.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const n = parseInt(hex[1]!, 16)
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 }
  }
  const rgba = value.match(
    /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)$/i,
  )
  if (rgba)
    return {
      r: Number(rgba[1]),
      g: Number(rgba[2]),
      b: Number(rgba[3]),
      a: rgba[4] === undefined ? 1 : Number(rgba[4]),
    }
  return null
}

/** Source-over composite, so a translucent rule is judged as it actually paints. */
const over = (fg: RGBA, bg: RGBA): RGBA => ({
  r: fg.r * fg.a + bg.r * (1 - fg.a),
  g: fg.g * fg.a + bg.g * (1 - fg.a),
  b: fg.b * fg.a + bg.b * (1 - fg.a),
  a: 1,
})

const channel = (c: number): number => {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

const luminance = (c: RGBA): number =>
  0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b)

/** Hue angle in degrees, and saturation 0..1, for the meaning rules below. */
function hsl(c: RGBA): { hue: number; sat: number } {
  const r = c.r / 255
  const g = c.g / 255
  const b = c.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d === 0) return { hue: 0, sat: 0 }
  const light = (max + min) / 2
  const sat = d / (1 - Math.abs(2 * light - 1))
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { hue: (((h * 60) % 360) + 360) % 360, sat }
}

/** Shortest way round the wheel. */
const hueDistance = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

function ratio(fg: RGBA, bg: RGBA): number {
  const front = fg.a < 1 ? over(fg, bg) : fg
  const a = luminance(front)
  const b = luminance(bg)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

const CAMPS = parseCamps(CSS)

/** Text: WCAG 1.4.3 AA. */
const TEXT = 4.5
/** Any graphic that carries meaning: WCAG 1.4.11. */
const GRAPHIC = 3

/** Tokens used for text, and therefore held to the text threshold. */
const TEXT_TOKENS = [
  '--ink',
  '--ink-dim',
  '--ink-faint',
  '--accent',
  '--ok',
  '--warn',
  '--caution',
  '--merit',
  '--state-new',
  '--state-active',
  '--state-critical',
  '--state-stalled',
  '--state-paused',
  '--state-completed',
]

/** Tokens that only ever paint a shape, and are held to the graphic threshold. */
const GRAPHIC_TOKENS = [
  '--dye-1',
  '--dye-2',
  '--dye-3',
  '--dye-4',
  '--dye-5',
  '--dye-6',
  '--rule-strong',
]

/** Both grounds anything can land on. Text sits on either, so both are checked. */
const GROUNDS = ['--ground', '--ground-raised']

describe('tokens.css structure', () => {
  it('defines all five camps', () => {
    expect([...CAMPS.keys()].sort()).toEqual(['jigoku', 'kuro', 'lacquer', 'sumi', 'washi'])
  })

  it('gives every camp the identical token vocabulary — a camp changes values, never names', () => {
    const lacquer = CAMPS.get('lacquer')!
    const colourNames = [...lacquer.keys()].filter(
      (k) => parseColour(lacquer.get(k)!) !== null && k !== '--accent-ink',
    )
    for (const [name, camp] of CAMPS) {
      if (name === 'lacquer') continue
      const missing = colourNames.filter((k) => !camp.has(k))
      expect({ camp: name, missing }).toEqual({ camp: name, missing: [] })
    }
  })

  it('never leaves a colour token undefined in a camp', () => {
    for (const [name, camp] of CAMPS)
      for (const token of [...TEXT_TOKENS, ...GRAPHIC_TOKENS, ...GROUNDS])
        expect({ camp: name, token, value: camp.get(token) }).toMatchObject({
          value: expect.any(String),
        })
  })
})

describe('contrast — the binding rule', () => {
  const failures: string[] = []

  for (const [campName, camp] of CAMPS) {
    describe(campName, () => {
      for (const groundToken of GROUNDS) {
        const ground = parseColour(camp.get(groundToken) ?? '')
        if (!ground) continue

        it(`carries every text token on ${groundToken} at ${TEXT}:1`, () => {
          const bad: Record<string, number> = {}
          for (const token of TEXT_TOKENS) {
            const fg = parseColour(camp.get(token) ?? '')
            if (!fg) continue
            const r = ratio(fg, ground)
            if (r < TEXT) {
              bad[token] = Number(r.toFixed(2))
              failures.push(`${campName} ${token} on ${groundToken} = ${r.toFixed(2)}`)
            }
          }
          expect(bad).toEqual({})
        })

        it(`carries every graphic token on ${groundToken} at ${GRAPHIC}:1`, () => {
          const bad: Record<string, number> = {}
          for (const token of GRAPHIC_TOKENS) {
            const fg = parseColour(camp.get(token) ?? '')
            if (!fg) continue
            const r = ratio(fg, ground)
            if (r < GRAPHIC) {
              bad[token] = Number(r.toFixed(2))
              failures.push(`${campName} ${token} on ${groundToken} = ${r.toFixed(2)}`)
            }
          }
          expect(bad).toEqual({})
        })
      }

      it('keeps the focus ring visible against both grounds', () => {
        // The focus ring is --accent at 2px. It is the one affordance a keyboard
        // user must never have to hunt for, so it is held to the graphic floor
        // in every camp without exception.
        const accent = parseColour(camp.get('--accent') ?? '')!
        for (const groundToken of GROUNDS) {
          const ground = parseColour(camp.get(groundToken) ?? '')
          if (!ground) continue
          expect({ ground: groundToken, r: ratio(accent, ground) >= GRAPHIC }).toEqual({
            ground: groundToken,
            r: true,
          })
        }
      })
    })
  }
})

describe('meaning rules', () => {
  it('never lets an identity dye collide with a state colour', () => {
    // The first draft spread identity across the full hue wheel, which put a
    // money goal six degrees from --ok and a deadline goal on top of --caution.
    //
    // The measure is hue angle, not RGB distance: two dark colours can sit close
    // in RGB and still be plainly different to look at, and it is confusability
    // with a warning that matters here, not numeric proximity. Dyes live in the
    // indigo band; every state colour is green, amber or red, so a wide angular
    // separation is exactly the property to assert.
    const STATE = ['--caution', '--ok', '--warn', '--accent']
    const MIN_ANGLE = 35

    for (const [campName, camp] of CAMPS) {
      for (const dyeToken of GRAPHIC_TOKENS.filter((t) => t.startsWith('--dye'))) {
        const dye = hsl(parseColour(camp.get(dyeToken) ?? '')!)
        // SUMI and KURO are deliberately monochrome: state is carried by form
        // there, not colour, so hue separation is neither possible nor wanted.
        if (dye.sat < 0.15) continue
        for (const stateToken of STATE) {
          const state = hsl(parseColour(camp.get(stateToken) ?? '')!)
          if (state.sat < 0.15) continue
          const angle = hueDistance(dye.hue, state.hue)
          expect({
            campName,
            dyeToken,
            stateToken,
            angle: Math.round(angle),
            clear: angle >= MIN_ANGLE,
          }).toMatchObject({ clear: true })
        }
      }
    }
  })

  it('keeps every identity dye inside the indigo band', () => {
    // Identity is allowed one family. Anything outside it means state.
    for (const [campName, camp] of CAMPS) {
      for (const dyeToken of GRAPHIC_TOKENS.filter((t) => t.startsWith('--dye'))) {
        const dye = hsl(parseColour(camp.get(dyeToken) ?? '')!)
        if (dye.sat < 0.15) continue // monochrome camps opt out by design
        expect({
          campName,
          dyeToken,
          hue: Math.round(dye.hue),
          inBand: dye.hue >= 165 && dye.hue <= 295,
        }).toMatchObject({
          inBand: true,
        })
      }
    }
  })

  it('holds merit to gold, never purple, in every camp', () => {
    for (const [campName, camp] of CAMPS) {
      const merit = parseColour(camp.get('--merit') ?? '')!
      const accent = parseColour(camp.get('--accent') ?? '')!
      expect({ campName, sameAsAccent: merit }).toEqual({ campName, sameAsAccent: accent })
    }
  })

  it('gives LACQUER a ground that is not the neutral near-black it replaced', () => {
    // The first proposal's default camp was chromatically the old VOID world
    // renamed: same neutral #060607, same amber accent, same ratios. Kachi-iro
    // is blue-shifted, and this asserts it stays that way.
    const ground = parseColour(CAMPS.get('lacquer')!.get('--ground')!)!
    expect(ground.b).toBeGreaterThan(ground.r + 6)
  })
})
