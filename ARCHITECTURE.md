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
  cinema/     decorative environments and factual presentation primitives; no persistence.
  shell/      chrome: rail, hotkeys, palette, dispatch, ceremony, undo, sound, prefs.
  routes/     the nine surfaces.
```

## Three rules that hold it together

**1. The domain layer imports nothing.** Every rule that decides where you stand — pace, momentum,
progress, XP, achievements, the identity of a goal — is a pure function over plain values. That is
why it can be exhaustively tested without a browser, and why the same numbers appear on every
surface.

**2. Every mutation writes an event, and every event knows what caused it.** `src/data/repo.ts` is
the only place anything is written, and it writes the record and the timeline event describing it _in
the same transaction_. Momentum, rank, merit, streaks, honours, the survey and the chronicle are all
folds over that log. Nothing derived is stored, so nothing derived can drift.

This was a claim before it was a fact. Adding a gate, cutting a tie, reparenting, moving a target,
changing the rhythm, declaring a siege, striking a standard — all of them used to happen in silence,
or as a generic `edited`. The vocabulary in `EVENT_TYPES` is now specific enough that any change to
the record can be explained later, and deliberately narrow enough that the chronicle is not a debug
log: a settings change writes nothing, because it says nothing about the campaign.

Every event a single act produces carries that act's id in `cause`. That is what makes an undo a
reversal of the whole causal result rather than a subtraction. See DATA-MODEL.md.

**3. No component recomputes a domain number.** `src/state/selectors.ts` is the single place records
become what the interface displays. If two surfaces disagreed about whether a standard is behind, the
product would be lying to somebody.

**4. No screen has to behave correctly for the record to stay sound.** `src/domain/invariants.ts`
holds every shape that must be impossible — parent cycles, one-sided ties, a target of zero, a gate
marked passed above a figure that came back down. The repository calls it before it writes and import
calls it on the way in, so a screen with a bug in it can produce a refusal but not a corruption.

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
  repo.reconcileAchievements()     re-derives honours, writes the difference BOTH ways
       │   (an honour earned by a dispatch that was undone is not held)
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

| File                      | What it owns                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| `domain/pace.ts`          | `perWeek`, `paceGap`, `BEHIND`, `arrival`, `pressure`, `projectedFinish`. Ported verbatim from v1. |
| `domain/progress.ts`      | `fraction` across all ten kinds, `isDone`, `stateOf`, streaks, money rounding.                     |
| `domain/momentum.ts`      | The wind. A recency-weighted, per-day-saturated fold with no negative term.                        |
| `domain/xp.ts`            | Merit and the rank ladder. XP is stamped on the event at write time.                               |
| `domain/achievements.ts`  | 23 honours as pure predicates over a snapshot.                                                     |
| `domain/identity.ts`      | Deterministic per-goal crest, dye and orbit from the goal's id.                                    |
| `domain/history.ts`       | Folds for the chronicle and the survey: periods, runs, comebacks, records, houses.                 |
| `domain/copy.ts`          | The chronicle's voice, and the rule that behind is never failure.                                  |
| `domain/invariants.ts`    | The shapes that cannot exist, and the one place they are prevented.                                |
| `data/repo.ts`            | Every mutation. The only writer.                                                                   |
| `data/migrations.ts`      | `goals.v1` → v2. Copies, never moves.                                                              |
| `data/backup.ts`          | Export, and an import that salvages, quarantines and repairs.                                      |
| `state/selectors.ts`      | `GoalView` and `WorldView` — everything the interface knows.                                       |
| `field/layout.ts`         | The war table's coordinate system. Pure and tested.                                                |
| `campaign/layout.ts`      | The camp's ground plan. Pure.                                                                      |
| `design/contrast.test.ts` | Parses `tokens.css` and fails the build on any contrast violation.                                 |
| `design/motion.css`       | Every keyframe and the `--dur-*`/`--ease-*` tokens. The six motion words.                          |
| `design/motion.ts`        | The same numbers for the two places that need them in JS.                                          |

## Conventions

- **CSS is plain CSS, co-located.** One file per component or surface, imported by it. No CSS-in-JS,
  no utility framework. Every colour is a semantic token; no component writes a literal.
- **Overlays mount on open.** The palette, the dispatch sheet and the ceremony are keyed so they
  mount when they appear and unmount when they close. Their state is therefore correct by
  construction rather than reset from an effect.
- **No `setState` in an effect body.** Enforced by lint. Derive at render, or key the component.
- **Nothing is stored that can be derived.** If you find yourself adding a cached field, check
  whether a fold over `events` gives it to you.
- **The offline shell is not a cache of the user's data.** `public/sw.js` caches the document and
  the hashed build assets, and nothing else. IndexedDB is the one canonical store; there is no second
  copy of anybody's record anywhere. The worker's cache is named for the build id, which is stamped
  onto its registration URL — a static `sw.js` at a fixed path would never update. A waiting version
  is announced and taken when the person says so, never applied under them mid-dispatch.
- **Never animate an ancestor of the WebGL canvas.** react-three-fiber renders no children until
  its container measures non-zero, and it may take that reading while a transform or an unresolved
  flex height is in flight — after which no genuine resize arrives to correct it. The result is a
  permanently empty scene with nothing in the console. `CampaignScene` passes
  `resize={{ debounce: 0, scroll: false }}` and the scene is pinned to a resolved box; both files
  carry the warning.

## Continuous integration

`.github/workflows/ci.yml` runs on every push and every pull request to `main`: install pnpm, install
with the frozen lockfile, then **lint, typecheck, test, build and the end-to-end suite**, each as its
own named step so the failing one is visible in the job summary rather than buried in a log. The pnpm
store is cached on the lockfile hash, a newer push to the same branch cancels the older run, and a
failed end-to-end run uploads its Playwright report.

Nothing in this repository depends on somebody remembering to run `pnpm check`.

|                  |                                                                               |
| ---------------- | ----------------------------------------------------------------------------- |
| `pnpm check`     | lint + typecheck + test + build. What CI runs, minus the browser.             |
| `pnpm e2e`       | the Playwright journeys, against a production build served by `vite preview`. |
| `pnpm check:all` | both.                                                                         |

## Testing

`pnpm test` — Vitest, **forks pool** (the threads pool intermittently times out waiting
for a worker on Windows and fails a green suite for no reason).

`pnpm e2e` — Playwright, three projects: **desktop**, **phone** (Pixel 7) and **still-air** (reduced
motion forced). Each test gets its own browser context, so IndexedDB is already empty and nothing has
to be cleared between them — an init script that wiped storage would also wipe it on the second
navigation inside a single test. The web server builds and previews: the thing shipped is the thing
tested.

What is covered: the inherited v1 arithmetic assertion-for-assertion, money rounding across a hundred
writes, date maths across DST and leap boundaries, progress and completion for every kind, streaks,
momentum's shape (steady beats bursty, recency beats age, never negative, never above one), the XP
curve, all 23 honours, procedural identity's determinism, the field's line being exact for any span,
the history folds, every invariant in `domain/invariants.ts`, persistence end to end — migration
(including two concurrent boots), export/import round-trip, partial-corruption salvage, orphan
removal, ledger repair — and **undo as a causal reversal**: one gate, several gates, a completion, a
personal record, gates and a completion together, an entry that is not the most recent, a `set`
correction after it, a backdated dispatch, two dispatches inside the same millisecond, honours
revoked and honours kept, and re-logging afterwards.

## Adding something

- **A new goal kind** → `GOAL_KINDS` in `domain/types.ts`, a `fraction` case in `domain/progress.ts`,
  an enclosure in `viz/Mon.tsx`, a label in `domain/format.ts`. Add a test in `progress.test.ts`.
- **A new honour** → one entry in `ACHIEVEMENTS` in `domain/achievements.ts`. It is a pure predicate;
  nothing else changes, and the badge draws itself from the id.
- **A new surface** → a route in `App.tsx`, an entry in `SURFACE` in `design/marks.ts`, a rail entry
  in `shell/AppShell.tsx`, and a `short` label of eight characters or fewer for compact navigation.
  Re-run `node scripts/subset-marks.mjs` if you added a kanji.
- **A new colour** → you probably do not need one. If you do, it goes in all five camps in
  `tokens.css` and the contrast test will tell you immediately if it fails.

## Cinematic presentation

`src/cinema/environment.ts` owns intensity thresholds, route-space lookup and the five world material
names/directions. `SceneWorld` reads the existing world selectors, settings and ceremony cue. It is an
aria-hidden sibling of content, never a Canvas ancestor. One requestAnimationFrame phase writes CSS
properties for environment and cloth, with no React updates per frame. It stops for hidden tabs,
non-intersection, momentum below 0.12, STILL AIR, Dojo and Quartermaster. `SceneFocus` restores main
focus after navigation while respecting form autofocus. The shell's route-keyed `scene-threshold` is
pointer-transparent; `cinema.css` owns its 360ms variants and removes it under reduced motion.

Extend the existing primitives: `GoalPresence` consumes `GoalView` for crest, form and progress;
`CampaignIntel` consumes selector-derived fractions/pace gaps for its labelled plot and exact rows;
`TimeStrata` consumes history `Period` values and exposes selected periods through semantic buttons.
None writes data or owns another domain calculation. Styles and responsive composition live in
`cinema.css`; colour/type authorities remain `src/design/`.

Assets are versioned local WebP files in `public/assets/environments/`. `SceneWorld` selects valley or
chamber, with a 640px source at viewport widths up to 640px and a 1536px source otherwise. The opening
War Table plate is eager; other picture routes are lazy. Failed images hide without hiding controls.
Ceremony uses the chamber in CSS. Keep generation prompts, dimensions and compression provenance in
`PROVENANCE.md`; replace art with a new filename so the existing service-worker asset cache can update.
There is no runtime image-generation service or remote media dependency.

WebGL stays in the lazy `CampaignScene` chunk. Terrain is one memoized plane with 48×48 subdivisions;
its shader fades alpha from 0.85 to 1.8 times the layout extent. Dispose custom geometry on unmount;
React Three Fiber owns declarative materials. Ties reuse one buffer and explicitly dispose their
geometry/material. DPR is capped at 1.75. Zero intensity and hidden tabs select demand rendering;
STILL AIR also removes camera damping and focus travel. Labels stay at constant HTML size, and dense
formations limit names to the heaviest 22 plus the relevant selection. `OpeningFrame` fits camera
distance to the measured canvas aspect on resize; orbit distance is capped at ten times extent.
Preserve the resolved Canvas box and immediate resize measurement described above.

The ceremony owns its eight-beat siege timeline. Animated siege holds its last beat; STILL AIR's big
ceremonies have no advance/close timer and use explicit controls. On phones, the shrine CTA is fixed
and the siege content reserves 100px beneath its record. Keep focus trapping and Escape dismissal when
changing staging. Sound remains gated by the existing setting.

Plant reserves a UUID once. NewGoal accepts that ID, makeGoal preserves it, and repository creation
uses Dexie add to reject collisions atomically. Existing records and schemas are unchanged. The ritual
regression test covers identity continuity and collision safety.
