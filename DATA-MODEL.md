# DATA MODEL

Everything is on the device, in IndexedDB, under the database `ambition-engine`. There is no server
and no copy but the user's. That is the whole reason this file is careful.

## Tables

| Store | Key | Indexes | What it holds |
|---|---|---|---|
| `goals` | `id` | kind, archived, paused, deadline, category, parentId, updatedAt, completedAt | The standards. |
| `milestones` | `id` | goalId, order, done, **doneBy** | Gates. |
| `entries` | `id` | goalId, at | The ledger — every dispatch. |
| `events` | `id` | goalId, at, type, **cause** | The chronicle. |
| `achievements` | `id` | at | Honours unlocked. |
| `meta` | `key` | — | Settings, snapshots, and the kept v1 blob. |

Dexie version 3.

Types are in `src/domain/types.ts`; the Zod schemas that guard every boundary are in
`src/domain/schema.ts`.

## The spine

`entries` is the **ledger** — what was done. `events` is the **chronicle** — what happened, including
things that are not dispatches (planted, gate passed, hour moved, struck, raised, taken, reopened,
honour, record).

`goal.current` is a **cached fold of the ledger**, not an independent fact. `recomputeCurrent()`
rebuilds it, and import runs that reconciliation on every goal, reporting how many disagreed.

Everything else is derived at read time and stored nowhere: momentum, merit, rank, streaks, honours,
the survey's figures, the chronicle's periods.

**Merit is the one exception, and deliberately so.** `event.xp` is stamped at write time rather than
recomputed, so tuning the curve later never rewrites what somebody already earned.

## Cause: what one act did

A dispatch is never only a number. One call to `logProgress` can move the figure, cross several
gates, set a personal record, close the goal, pay merit on each of those, and unlock honours off the
back of them.

**The entry's own id is the act's id**, and everything that act produces carries it:

| Field | On | Means |
|---|---|---|
| `event.cause` | every event the dispatch wrote | this event exists because of that dispatch |
| `milestone.doneBy` | a gate the figure crossed | arithmetic passed this gate, not a person |
| `goal.completedBy` | the goal it closed | a dispatch closed this, not a person |
| `achievement.cause` | an honour it earned | this honour was earned by that dispatch |

That is what makes `undoEntry` a reversal rather than an approximation. It deletes the events with
that cause, unticks the gates with that `doneBy` — never one a person ticked by hand, which is a
statement about the world rather than about the number — reopens the goal only if that act closed
it, revokes the honours it earned, and then **replays the figure from the surviving ledger** rather
than subtracting the amount back out. Replaying is the only thing that survives undoing a `set`
correction, or undoing an entry that is not the most recent.

The previous implementation matched events to acts by asking whether their timestamps fell within
two seconds of each other. Two dispatches in the same second deleted each other's events.

### The ledger's order

`entry.seq` is a per-goal counter assigned at write time. `at` alone is not a total order — two
dispatches can share a millisecond — and a `set` entry REPLACES the figure rather than adding to it,
so an ambiguous order rebuilds to a different number each time. `ledgerOrder` in `progress.ts` sorts
by `(at, seq)` and everything that replays the ledger uses it.

## Invariants

1. A record and the event describing it are written in **one transaction** (`repo.ts`). The chronicle
   cannot drift from the data.
2. An event carries the instant of the thing it describes, **not** the instant it was written. A
   backdated dispatch lands on the day it belongs to. (This was a real bug: events stamped `now()`
   made momentum read 9 where seventeen dispatches over eighteen days should read 60.)
3. Deleting hands back every removed row so it can be restored exactly, and detaches sub-goals rather
   than destroying them. The striking itself is recorded with **no goal id**, so it survives the
   removal of every event that had one.
4. Nothing derived is stored — except `event.xp`, above.
5. **Merit is paid once.** An award is for a thing happening. Untick a gate and tick it again, or
   reopen and retake a goal, and the event is written again but the merit is not. Without this the
   rank ladder is a button rather than a record.

## The shapes that cannot exist

`src/domain/invariants.ts` is the one place these are enforced. The repository calls it before every
write; import calls `normaliseWorld` on the way in. No screen has to behave correctly for the record
to stay sound.

| Refused or repaired | What it used to do |
|---|---|
| A goal that is its own parent, or inside a loop of ownership | Reachable in six clicks on the campaign; the goals in the loop vanished from the roll |
| A tie to itself, a duplicate tie, a tie with only one end | A one-sided tie duplicated on the next toggle |
| A parent or tie pointing at a goal that is gone | Silent, until something walked it |
| A target of zero or less, or one that is not a number | `isDone` was true immediately while `fraction` read 0%: a standard enshrined at nought |
| A figure below nought, or a percentage above its target | — |
| A recurrence of zero times | The import schema refused the row, taking the goal and its whole ledger with it |
| `done` and `completedAt` disagreeing | Half-taken |
| A value gate marked passed above a figure that came back down | The runway lied |
| A project whose parts are all done but which is not closed | The shrine showed TAKEN with no completion in the record |

A cycle is broken at the edge that closes it rather than by dropping the goals in it: losing a
relationship is recoverable, losing goals is not. Every repair is reported as a sentence a person can
read — in the import report, and in the Quartermaster's integrity panel.

## Migration from the v1 almanac

The old product kept a bare JSON array in `localStorage` under `goals.v1`:

```json
[{ "id": "…", "type": "money" | "milestone", "title": "…", "target": 2400,
   "current": 350, "done": false, "deadline": "2026-12-01", "createdAt": "2026-08-01" }]
```

`src/data/migrations.ts` maps it: money → a money standard, milestone → a milestone standard. The
accumulated `current` is replayed as a **single carried-over ledger entry dated at the goal's
creation**, so `recomputeCurrent` agrees with the cached value and the chronicle does not claim the
money moved today.

**The original is copied, never moved.** `localStorage['goals.v1']` is left untouched and a verbatim
copy is written to `meta['legacy.goals.v1']`. The quartermaster can confirm it is still there. If
this migration is wrong in a way nobody notices for a month, the original is still sitting where it
always was.

The guard and the insert share **one transaction**, because a read-then-write guard with an `await`
between them is a race — and React StrictMode's double-mount hits it every time. IndexedDB serialises
readwrite transactions over the same stores, so re-checking inside makes it safe against any number
of concurrent callers. Two independent guards apply: the `migratedAt` marker, and refusing to run
when any goal already exists. Neither alone is enough — somebody who clears the database but keeps
the marker still deserves their data back.

## Backup

Export writes `ambition-{date}.json`: a versioned envelope holding every table and the settings.

Import never trusts its input:

- **v2 backup, v1 almanac array, or a v2 file with broken rows** — all three are accepted.
- **Salvage per row.** What parses is kept; what does not is quarantined and reported by table and
  index. One bad record does not lose the file.
- **Orphans dropped.** Gates, dispatches and events pointing at goals that are gone; parent and tie
  references to ids that do not exist.
- **Ledgers reconciled.** Any cached total disagreeing with its ledger is rebuilt from it, and the
  count is reported.
- **The whole shape put right.** `normaliseWorld` runs the full invariant pass above, and every
  change it had to make is reported in `ImportReport.repairs` as a plain sentence.
- **The restore is recorded.** An `imported` event is written after the rows, so the chronicle never
  shows a record that simply begins.
- **A snapshot first.** The existing world is serialised into `meta['snapshots']` (last five) before
  anything is overwritten.

It refuses only one thing: a file whose goals are all unreadable.

## Schema versioning

`BACKUP_VERSION` is 3, and so is Dexie's — v1 was localStorage-only and never had an IndexedDB
store, so the numbering matches the data format rather than pretending there was a v1 database.
Version 3 added `cause`, `doneBy`, `completedBy` and `seq`; the upgrade backfills them with null,
which is the correct answer to "which dispatch owns this?" for a row written before the question
could be asked.

Unknown keys are stripped rather than rejected, so a backup from a newer build still imports what
this build understands. One legacy alias survives in `schema.ts`: a Stage-1 build stored a free
0–359 `hue` where `dye` now lives, and a file from it is still read.
