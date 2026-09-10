import type { WorldId } from '@/domain/types'

export type Intensity = 'quiet' | 'active' | 'rising' | 'high' | 'siege'
export function intensityFor(score: number, trend: number, siege = false): Intensity {
  if (siege) return 'siege'
  if (score >= 0.65) return 'high'
  if (score < 0.12) return 'quiet'
  return trend > 0.05 ? 'rising' : 'active'
}
export const ENVIRONMENTS: Record<WorldId, { material: string; light: string; direction: number }> =
  {
    lacquer: { material: 'lacquer', light: 'DAWN ON LACQUER', direction: 1 },
    washi: { material: 'fibre', light: 'LIGHT THROUGH PAPER', direction: 1 },
    sumi: { material: 'ink', light: 'INK IN STILL WATER', direction: -1 },
    kuro: { material: 'stone', light: 'MOON ON STONE', direction: 1 },
    jigoku: { material: 'ash', light: 'EMBER UNDER ASH', direction: -1 },
  }
export function spaceFor(path: string) {
  return path.split('/')[1] || 'war'
}
