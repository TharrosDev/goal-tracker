import { describe, expect, it } from 'vitest'
import { elapsedFraction, FOOT_BAND, layoutField, lineOf, RESERVE_BAND, widthOf } from './layout'
import { viewOf } from '@/state/selectors'
import { goal } from '@/test/fixtures'
import type { Goal } from '@/domain/types'

const view = (g: Partial<Goal>, at = '2026-06-01') => viewOf(goal(g) as Goal, [], [], at)

const SIZE = { width: 1000, height: 500, at: '2026-06-01' }

describe('elapsedFraction', () => {
  it('is zero on the day a standard is planted and one at its hour', () => {
    const g = view({ startDate: '2026-01-01', deadline: '2026-12-31' })
    expect(elapsedFraction(g, '2026-01-01')).toBe(0)
    expect(elapsedFraction(g, '2026-12-31')).toBe(1)
  })

  it('is exactly half at the halfway point, whatever the span', () => {
    expect(
      elapsedFraction(view({ startDate: '2026-01-01', deadline: '2026-01-11' }), '2026-01-06'),
    ).toBe(0.5)
    expect(
      elapsedFraction(view({ startDate: '2020-01-01', deadline: '2030-01-01' }), '2025-01-01'),
    ).toBeCloseTo(0.5, 2)
  })

  it('clamps rather than running off either end', () => {
    const g = view({ startDate: '2026-01-01', deadline: '2026-01-11' })
    expect(elapsedFraction(g, '2025-06-01')).toBe(0)
    expect(elapsedFraction(g, '2027-01-01')).toBe(1)
  })

  it('is null without an hour, which is what sends a standard to the reserve', () => {
    expect(elapsedFraction(view({ deadline: null }), '2026-06-01')).toBeNull()
  })

  it('reads a same-day hour as arrived rather than dividing by zero', () => {
    expect(
      elapsedFraction(view({ startDate: '2026-01-01', deadline: '2026-01-01' }), '2026-01-01'),
    ).toBe(1)
  })
})

describe('the line is exact, not decorative', () => {
  it('puts a standard exactly on the line when it is exactly on pace', () => {
    // Half its span elapsed, half its target reached.
    const v = view(
      { startDate: '2026-01-01', deadline: '2026-12-31', target: 100, current: 50 },
      '2026-07-02',
    )
    const layout = layoutField([v], { ...SIZE, at: '2026-07-02' })
    const p = layout.dated[0]!
    expect(p.height).toBeCloseTo(p.lineHeight, 0)
  })

  it('holds for any span, which is the whole point of plotting elapsed rather than days', () => {
    const short = view(
      { startDate: '2026-06-01', deadline: '2026-06-11', target: 100, current: 50 },
      '2026-06-06',
    )
    const long = view(
      { startDate: '2020-01-01', deadline: '2030-01-01', target: 100, current: 50 },
      '2025-01-01',
    )
    for (const [v, at] of [
      [short, '2026-06-06'],
      [long, '2025-01-01'],
    ] as const) {
      const p = layoutField([v], { ...SIZE, at }).dated[0]!
      expect(Math.abs(p.height - p.lineHeight)).toBeLessThan(2)
    }
  })

  it('puts an ahead standard above the line and a behind one below it', () => {
    const at = '2026-07-02'
    const ahead = view(
      { startDate: '2026-01-01', deadline: '2026-12-31', target: 100, current: 90 },
      at,
    )
    const behind = view(
      { startDate: '2026-01-01', deadline: '2026-12-31', target: 100, current: 10 },
      at,
    )
    const layout = layoutField([ahead, behind], { ...SIZE, at })
    for (const p of layout.dated) {
      if (p.view.goal.current === 90) expect(p.height).toBeGreaterThan(p.lineHeight)
      else expect(p.height).toBeLessThan(p.lineHeight)
    }
  })

  it('runs from the ground at the left edge to full height at the right', () => {
    const layout = layoutField([], SIZE)
    const line = lineOf(layout, SIZE.width)
    expect(line).toMatchObject({ x1: 0, y1: layout.ground, x2: SIZE.width })
    expect(line.y2).toBe(layout.ground - layout.usable)
  })
})

describe('layoutField', () => {
  it('sends standards with no hour to the reserve, heaviest first', () => {
    const a = view({ id: 'a', deadline: null, priority: 1, difficulty: 1 })
    const b = view({ id: 'b', deadline: null, priority: 5, difficulty: 5, boss: true })
    const layout = layoutField([a, b], SIZE)
    expect(layout.dated).toHaveLength(0)
    expect(layout.reserve.map((v) => v.goal.id)).toEqual(['b', 'a'])
  })

  it('gives a heavier standard more of the screen', () => {
    expect(widthOf(1)).toBeGreaterThan(widthOf(0))
    const heavy = view({ id: 'h', deadline: '2026-12-31', priority: 5, difficulty: 5, boss: true })
    const light = view({ id: 'l', deadline: '2026-12-31', priority: 1, difficulty: 1 })
    const layout = layoutField([heavy, light], SIZE)
    const byId = new Map(layout.dated.map((p) => [p.view.goal.id, p]))
    expect(byId.get('h')!.width).toBeGreaterThan(byId.get('l')!.width)
  })

  it('never lets two standards overlap', () => {
    // Ten goals with the identical span all want the same centre.
    const views = Array.from({ length: 10 }, (_, i) =>
      view({ id: `g${i}`, startDate: '2026-01-01', deadline: '2026-12-31' }, '2026-07-02'),
    )
    const layout = layoutField(views, { ...SIZE, at: '2026-07-02' })
    const sorted = [...layout.dated].sort((a, b) => a.x - b.x)
    for (let i = 1; i < sorted.length; i += 1)
      expect(sorted[i]!.x).toBeGreaterThanOrEqual(sorted[i - 1]!.x + sorted[i - 1]!.width)
  })

  it('keeps every standard inside the field, even when it is too narrow for them', () => {
    const views = Array.from({ length: 12 }, (_, i) =>
      view(
        {
          id: `g${i}`,
          startDate: '2026-01-01',
          deadline: '2026-12-31',
          priority: 5,
          difficulty: 5,
        },
        '2026-07-02',
      ),
    )
    const layout = layoutField(views, { width: 400, height: 500, at: '2026-07-02' })
    for (const p of layout.dated) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(400)
    }
  })

  it('keeps the true datum even when a standard is nudged off it', () => {
    const views = Array.from({ length: 6 }, (_, i) =>
      view({ id: `g${i}`, startDate: '2026-01-01', deadline: '2026-12-31' }, '2026-07-02'),
    )
    const layout = layoutField(views, { ...SIZE, at: '2026-07-02' })
    // Every centre is the honest position; x is where it had to be drawn.
    for (const p of layout.dated) expect(p.centre).toBeCloseTo(0.5 * SIZE.width, 0)
  })

  it('leaves room below the ground for the feet, and for the reserve when there is one', () => {
    const dated = view({ id: 'd', deadline: '2026-12-31' })
    const undated = view({ id: 'u', deadline: null })

    const withoutReserve = layoutField([dated], SIZE)
    expect(withoutReserve.ground).toBe(SIZE.height - FOOT_BAND)

    const withReserve = layoutField([dated, undated], SIZE)
    expect(withReserve.ground).toBe(SIZE.height - FOOT_BAND - RESERVE_BAND)
    expect(withReserve.usable).toBeLessThan(withReserve.ground)
  })

  it('keeps a usable plot on a viewport too short for the bands', () => {
    const layout = layoutField([view({ deadline: '2026-12-31' })], {
      width: 800,
      height: 140,
      at: '2026-06-01',
    })
    expect(layout.ground).toBeGreaterThan(0)
    expect(layout.ground).toBeLessThanOrEqual(140)
  })

  it('survives a zero-sized field without producing NaN', () => {
    const v = view({ deadline: '2026-12-31' })
    const layout = layoutField([v], { width: 0, height: 0, at: '2026-06-01' })
    for (const p of layout.dated) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.height)).toBe(true)
    }
  })
})
