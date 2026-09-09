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
  created: (d) =>
    d.migrated
      ? 'Planted. Carried over from the almanac.'
      : n(d, 'gates') > 0
        ? `Planted, with ${n(d, 'gates')} gates.`
        : 'Planted.',
  progress: (d) => {
    // Migrated events carry only `amount`; native ones carry from/to as well.
    const moved = 'to' in d && 'from' in d ? n(d, 'to') - n(d, 'from') : n(d, 'amount')
    if (d.migrated) return `Carried over from the almanac: ${round(moved)}.`
    const base =
      d.mode === 'set'
        ? `Corrected to ${round(n(d, 'to'))}.`
        : `Moved ${round(Math.abs(moved))}${moved < 0 ? ' back' : ''}.`
    const note = s(d, 'note')
    const said = note ? `${base} “${note}”` : base
    if (d.recovery) return `${said} Raised again after a long quiet.`
    const streak = n(d, 'streak')
    return streak >= 7 ? `${said} ${streak} days unbroken.` : said
  },
  milestone: (d) => `Passed the gate${s(d, 'title') ? `: ${s(d, 'title')}` : ''}.`,
  milestone_added: (d) => `A gate was set: ${s(d, 'title') || 'one more part'}.`,
  milestone_removed: (d) => `The gate ${s(d, 'title') || 'was'} taken off the runway.`,
  milestone_reopened: (d) => {
    const title = s(d, 'title')
    const why = s(d, 'reason')
    return `${title ? `${title} stands open again` : 'A gate stands open again'}${why ? ` — ${why}` : ''}.`
  },
  deadline_changed: (d) =>
    s(d, 'to') ? `The hour moved to ${s(d, 'to')}.` : 'The hour was lifted.',
  target_changed: (d) =>
    d.to === null
      ? 'The target was lifted.'
      : `The target moved to ${round(n(d, 'to'))}${d.from === null ? '' : ` from ${round(n(d, 'from'))}`}.`,
  recurrence_changed: (d) => `The rhythm is now ${s(d, 'to') || 'unset'}.`,
  difficulty_changed: (d) =>
    `Reckoned ${n(d, 'to') > n(d, 'from') ? 'harder' : 'easier'} than before: ${n(d, 'to')} of 5.`,
  boss_declared: (d) => (d.boss ? 'Declared a siege.' : 'No longer a siege.'),
  identity_changed: (d) =>
    s(d, 'to') && s(d, 'from')
      ? `Renamed from ${s(d, 'from')}.`
      : `Amended: ${s(d, 'fields').split(',').join(', ') || 'its particulars'}.`,
  linked: (d) => `Tied to ${s(d, 'title') || 'another standard'}.`,
  unlinked: (d) => `The tie to ${s(d, 'title') || 'another standard'} was cut.`,
  reparented: (d) =>
    s(d, 'title') ? `Now belongs to ${s(d, 'title')}.` : 'Freed. It stands on its own.',
  paused: () => 'Struck. Not abandoned.',
  resumed: (d) =>
    n(d, 'away') >= 1 ? `Raised again after ${n(d, 'away')} days struck.` : 'Raised again.',
  record: (d) => `A record: ${round(n(d, 'amount'))} in one dispatch.`,
  completed: (d) => {
    const held = n(d, 'days')
    return held > 0 ? `Taken, after ${held} days standing.` : 'Taken.'
  },
  reopened: (d) =>
    s(d, 'reason') ? `Reopened — ${s(d, 'reason')}.` : 'Reopened. It was not finished after all.',
  archived: () => 'Moved out of the field.',
  restored: () => 'Brought back to the field.',
  struck: (d) => `${s(d, 'title') || 'A standard'} was struck from the field.`,
  unstruck: (d) => `${s(d, 'title') || 'A standard'} was put back.`,
  imported: (d) =>
    `A record was brought in: ${n(d, 'goals')} standards, ${n(d, 'entries')} dispatches.`,
  edited: (d) => `Amended: ${s(d, 'fields').split(',').join(', ') || 'its particulars'}.`,
  note: (d) => s(d, 'text') || 'A note was added.',
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
