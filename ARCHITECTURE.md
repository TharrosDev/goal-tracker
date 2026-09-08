# ARCHITECTURE

Written for whoever picks this up next, human or agent. Read `PRODUCT.md` for what it is and
`DESIGN.md` for what it looks like and why.

## The shape

```
src/
  domain/     pure rules. No React, no DOM, no database. 210 tests live mostly here.
  data/       Dexie persistence, migrations, backup/restore, the mutation API.
  state/      the in-memory world (zustand) and the derived views the interface reads.
  design/     semantic tokens, the type scale, the motion vocabulary, the kanji marks.
  viz/        reusable primitives: Mon, Numeral, Trajectory, Mark.
  field/      the war table's coordinate system and its objects.
  campaign/   the spatial camp (lazy WebGL) and the roll (its accessible peer).
  shell/      chrome: rail, hotkeys, palette, dispatch, ceremony, undo, sound, prefs.
  routes/     the nine surfaces.
```

## Three rules that hold it together

**1. The domain layer imports nothing.** Every rule that decides where you stand — pace, momentum,
progress, XP, achievements, the identity of a goal — is a pure function over plain values. That is
why it can be exhaustively tested without a browser, and why the same numbers appear on every
surface.

**2. Every mutation writes an event.** `src/data/repo.ts` is the only place anything is written, and
it writes the record and the timeline event describing it *in the same transaction*. Momentum, rank,
merit, streaks, honours, the survey and the chronicle are all folds over that log. Nothing derived is
stored, so nothing derived can drift.

**3. No component recomputes a domain number.** `src/state/selectors.ts` is the single place records
become what the interface displays. If two surfaces disagreed about whether a standard is behind, the
product would be lying to somebody.

## Data flow

```
  a person acts
       │
       ▼
  useWorld().someAction()          src/state/world.ts
       │   (thin: calls the repo, then re-reads)
       ▼
  repo.someMutation()              src/data/repo.ts
       │   writes record + timeline event in ONE transaction
       ▼
  Dexie / IndexedDB                src/data/db.ts
       │
       ▼
  repo.syncAchievements()          re-derives honours, appends only the difference
       │
       ▼
  store re-reads everything        cheap at this scale; the UI can never see a half-applied change
       │
       ▼
  useWorldView()                   src/state/useWorldView.ts → selectors.worldView()
       │
       ▼
  the surfaces
```

The store deliberately holds plain arrays and recomputes the derived view from scratch on every
change. This product holds a handful of standards and a few thousand events — recomputing is cheaper
than maintaining indexes and far easier to keep correct. If that stops being true, the fix is
memoised selectors, **not** a second source of truth.

## Key modules

| File | What it owns |
|---|---|
| `domain/pace.ts` | `perWeek`, `paceGap`, `BEHIND`, `arrival`, `pressure`, `projectedFinish`. Ported verbatim from v1. |
| `domain/progress.ts` | `fraction` across all ten kinds, `isDone`, `stateOf`, streaks, money rounding. |
| `domain/momentum.ts` | The wind. A recency-weighted, per-day-saturated fold with no negative term. |
| `domain/xp.ts` | Merit and the rank ladder. XP is stamped on the event at write time. |
| `domain/achievements.ts` | 23 honours as pure predicates over a snapshot. |
| `domain/identity.ts` | Deterministic per-goal crest, dye and orbit from the goal's id. |
| `domain/history.ts` | Folds for the chronicle and the survey: periods, runs, comebacks, records, houses. |
| `domain/copy.ts` | The chronicle's voice, and the rule that behind is never failure. |
| `data/repo.ts` | Every mutation. The only writer. |
| `data/migrations.ts` | `goals.v1` → v2. Copies, never moves. |
| `data/backup.ts` | Export, and an import that salvages, quarantines and repairs. |
| `state/selectors.ts` | `GoalView` and `WorldView` — everything the interface knows. |
| `field/layout.ts` | The war table's coordinate system. Pure and tested. |
| `campaign/layout.ts` | The camp's ground plan. Pure. |
| `design/contrast.test.ts` | Parses `tokens.css` and fails the build on any contrast violation. |

## Conventions

- **CSS is plain CSS, co-located.** One file per component or surface, imported by it. No CSS-in-JS,
  no utility framework. Every colour is a semantic token; no component writes a literal.
- **Overlays mount on open.** The palette, the dispatch sheet and the ceremony are keyed so they
  mount when they appear and unmount when they close. Their state is therefore correct by
  construction rather than reset from an effect.
- **No `setState` in an effect body.** Enforced by lint. Derive at render, or key the component.
- **Nothing is stored that can be derived.** If you find yourself adding a cached field, check
  whether a fold over `events` gives it to you.

## Testing

`pnpm test` — 210 tests, Vitest, **forks pool** (the threads pool intermittently times out waiting
for a worker on Windows and fails a green suite for no reason).

What is covered: the inherited v1 arithmetic assertion-for-assertion, money rounding across a hundred
writes, date maths across DST and leap boundaries, progress and completion for every kind, streaks,
momentum's shape (steady beats bursty, recency beats age, never negative, never above one), the XP
curve, all 23 honours, procedural identity's determinism, the field's line being exact for any span,
the history folds, and persistence end to end — migration (including two concurrent boots),
export/import round-trip, partial-corruption salvage, orphan removal, ledger repair, and undo.

## Adding something

- **A new goal kind** → `GOAL_KINDS` in `domain/types.ts`, a `fraction` case in `domain/progress.ts`,
  an enclosure in `viz/Mon.tsx`, a label in `domain/format.ts`. Add a test in `progress.test.ts`.
- **A new honour** → one entry in `ACHIEVEMENTS` in `domain/achievements.ts`. It is a pure predicate;
  nothing else changes, and the badge draws itself from the id.
- **A new surface** → a route in `App.tsx`, an entry in `SURFACE` in `design/marks.ts`, a rail entry
  in `shell/AppShell.tsx`, and a `short` label of eight characters or fewer for the vertical rail.
  Re-run `node scripts/subset-marks.mjs` if you added a kanji.
- **A new colour** → you probably do not need one. If you do, it goes in all five camps in
  `tokens.css` and the contrast test will tell you immediately if it fails.
