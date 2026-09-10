import { describe, expect, it } from 'vitest'
import { ENVIRONMENTS, intensityFor, spaceFor } from './environment'
import { WORLD_IDS } from '@/domain/types'

describe('environment grammar', () => {
  it('keeps quiet momentum quiet even when its trend rises', () => {
    expect(intensityFor(0.08, 0.4)).toBe('quiet')
    expect(intensityFor(0.4, 0.1)).toBe('rising')
    expect(intensityFor(0.8, -0.1)).toBe('high')
    expect(intensityFor(0.4, -0.2)).toBe('active')
    expect(intensityFor(0, 0, true)).toBe('siege')
  })
  it('has one material direction per supported world and stable nested routes', () => {
    expect(Object.keys(ENVIRONMENTS)).toEqual([...WORLD_IDS])
    expect(new Set(Object.values(ENVIRONMENTS).map((e) => e.material)).size).toBe(5)
    expect(spaceFor('/standard/one')).toBe('standard')
    expect(spaceFor('/')).toBe('war')
  })
})
