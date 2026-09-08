# DATA MODEL

Everything is on the device, in IndexedDB, under the database `ambition-engine`. There is no server
and no copy but the user's. That is the whole reason this file is careful.

## Tables

| Store | Key | Indexes | What it holds |
|---|---|---|---|
| `goals` | `id` | kind, archived, paused, deadline, category, parentId, updatedAt, completedAt | The standards. |
| `milestones` | `id` | goalId, order, done | Gates. |
| `entries` | `id` | goalId, at | The ledger — every dispatch. |
| `events` | `id` | goalId, at, type | The chronicle. Append-only. |
| `achievements` | `id` | at | Honours unlocked. |
| `meta` | `key` | — | Settings, snapshots, and the kept v1 blob. |

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

## Invariants

1. A record and the event describing it are written in **one transaction** (`repo.ts`). The chronicle
   cannot drift from the data.
2. An event carries the instant of the thing it describes, **not** the instant it was written. A
   backdated dispatch lands on the day it belongs to. (This was a real bug: events stamped `now()`
   made momentum read 9 where seventeen dispatches over eighteen days should read 60.)
3. Deleting hands back every removed row so it can be restored exactly, and detaches sub-goals rather
   than destroying them.
4. Nothing derived is stored.

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
- **A snapshot first.** The existing world is serialised into `meta['snapshots']` (last five) before
  anything is overwritten.

It refuses only one thing: a file whose goals are all unreadable.

## Schema versioning

`BACKUP_VERSION` is 2. Dexie's version is also 2 — v1 was localStorage-only and never had an
IndexedDB store, so the numbering matches the data format rather than pretending there was a v1
database.

Unknown keys are stripped rather than rejected, so a backup from a newer build still imports what
this build understands. One legacy alias survives in `schema.ts`: a Stage-1 build stored a free
0–359 `hue` where `dye` now lives, and a file from it is still read.
