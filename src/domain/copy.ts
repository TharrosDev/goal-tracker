import type { EventType, TimelineEvent } from './types'

/**
 * THE CHRONICLE'S VOICE.
 *
 * One sentence per kind of event, written in the register of a campaign record.
 * Every one of them reports what happened; none of them passes judgement on the
 * person it happened to.
 *
 * The rule this file exists to hold: BEHIND IS NEVER FAILURE. There is no copy
 * here for falling short, no "missed", no "failed", no "overdue" as an accusation.
 * A silence is reported as a silence and a return is reported as a return.
 */

type Data = TimelineEvent['data']

const n = (d: Data, key: string): number => (typeof d[key] === 'number' ? d[key] : 0)
const s = (d: Data, key: string): string => (typeof d[key] === 'string' ? d[key] : '')

export const EVENT_COPY: Record<EventType, (data: Data) => string> = {
  created: (d) => (d.migrated ? 'Planted. Carried over from the almanac.' : 'Planted.'),
  progress: (d) => {
    // Migrated events carry only `amount`; native ones carry from/to as well.
    const moved = 'to' in d && 'from' in d ? n(d, 'to') - n(d, 'from') : n(d, 'amount')
    if (d.migrated) return `Carried over from the almanac: ${round(moved)}.`
    const base =
      d.mode === 'set'
        ? `Corrected to ${round(n(d, 'to'))}.`
        : `Moved ${round(Math.abs(moved))}${moved < 0 ? ' back' : ''}.`
    if (d.recovery) return `${base} Raised again after a long quiet.`
    const streak = n(d, 'streak')
    return streak >= 7 ? `${base} ${streak} days unbroken.` : base
  },
  milestone: (d) => `Passed the gate${s(d, 'title') ? `: ${s(d, 'title')}` : ''}.`,
  deadline_changed: (d) =>
    s(d, 'to') ? `The hour moved to ${s(d, 'to')}.` : 'The hour was lifted.',
  paused: () => 'Struck. Not abandoned.',
  resumed: () => 'Raised again.',
  record: (d) => `A record: ${round(n(d, 'amount'))} in one dispatch.`,
  completed: (d) => {
    const held = n(d, 'days')
    return held > 0 ? `Taken, after ${held} days standing.` : 'Taken.'
  },
  reopened: () => 'Reopened. It was not finished after all.',
  archived: () => 'Moved out of the field.',
  restored: () => 'Brought back to the field.',
  edited: () => 'Amended.',
  note: (d) => s(d, 'text') || 'A note was added.',
  level_up: (d) => `Rank ${n(d, 'level')}.`,
  achievement: (d) => `Honour: ${s(d, 'achievement').replace(/-/g, ' ').toUpperCase()}.`,
}

const round = (v: number): string =>
  (Math.round(v * 100) / 100).toLocaleString('en-CA', { maximumFractionDigits: 2 })

/**
 * How the product greets someone who has been away. Never a scold, never a
 * streak-loss notice — the length of the silence is simply named, because
 * naming it is what makes coming back possible.
 */
export function welcomeBack(days: number | null): string | null {
  if (days === null || days < 3) return null
  if (days < 7) return `${days} days since the last dispatch. The field is where you left it.`
  if (days < 30) return `${days} days away. Nothing has moved without you, and nothing is lost.`
  if (days < 180)
    return `${Math.round(days / 7)} weeks away. Every standard is still planted where it stood.`
  return 'A long time away. The field kept.'
}
