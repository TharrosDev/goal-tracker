# AMBITION ENGINE

A personal operating system for ambition. Local-first, no account, no server: your goals live in
your browser's IndexedDB and leave the device only when you export them.

> **Rebuild in progress.** This repository was a single-file nautical almanac tracker (`index.html`,
> `localStorage`, money and milestone goals). It is being rebuilt from first principles as a
> maximalist, spatial, event-sourced ambition engine. The v1 app is preserved in git history at
> `a3cafde`, and any `goals.v1` data in your browser is detected and migrated on first load —
> copied, never moved.

## Running it

```bash
pnpm install
pnpm dev        # vite dev server
pnpm check      # lint + typecheck + tests + production build
```

## Stack

Vite · React 19 · TypeScript (strict) · Zustand · Dexie (IndexedDB) · Zod · Motion ·
React Three Fiber (lazy) · Vitest.

## Architecture

```
src/domain/    pure rules. No React, no DOM, no database. Fully unit-tested.
src/data/      Dexie persistence, migrations, backup/restore, the mutation API.
src/state/     the in-memory world and the derived views the interface reads.
src/design/    semantic tokens, the type scale, the motion language.
```

Three rules hold the shape together:

1. **The domain layer imports nothing.** Every rule that decides where you stand — pace, momentum,
   XP, achievements, goal state — is a pure function over plain values.
2. **Every mutation writes an event.** Momentum, levels, streaks, achievements, analytics and the
   time machine are all folds over one append-only log. Nothing derived is stored twice.
3. **No component recomputes a domain number.** `src/state/selectors.ts` is the only place that
   turns records into what the interface displays.

## Data

Everything is on your device. Export writes a versioned JSON backup; import salvages what it can
parse, quarantines what it cannot, reconciles cached totals against the ledger, and snapshots your
current state before overwriting anything. A v1 almanac export can be imported directly.

Documentation for the data model, the visual system and the motion system lands with the finished
build.
