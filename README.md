# THE AMBITION ENGINE

A personal operating system for ambition, in the register of a Sengoku war camp.

Time runs left to right across the whole viewport as elapsed span. Progress rises from a ground line.
One diagonal — **the line** — is drawn once across the field and shows where every campaign should
stand by now, so being behind is a visible vertical distance rather than a number to read. Momentum
is **the wind**: one force that moves everything at once, so a strong month is legible before a
single figure is.

Local-first. No account, no server, no network request at runtime. Your record lives in your
browser's IndexedDB and leaves the device only when you export it — and once the app has been
opened once, it works with no network at all.

```bash
pnpm install
pnpm dev
pnpm check        # lint + typecheck + 280 tests + production build
pnpm e2e          # 30 journeys through a real browser
```

CI runs all of it on every push and pull request to `main`.

## The surfaces

| | | |
|---|---|---|
| 陣 | **THE WAR TABLE** | the field: the wind, every standard against its line, the next hour |
| 戦 | **THE CAMPAIGN** | the same field pulled back — a camp pitched in space, and its roll |
| 旗 | **A STANDARD** | one goal's own ground: its figure, its trajectory, its chronicle |
| 道場 | **THE DOJO** | one opponent, one technique, nothing else in the room |
| 社 | **THE SHRINE** | taken standards, kept as monuments |
| 記 | **THE CHRONICLE** | your best stretch, longest run, biggest comeback |
| 誉 | **HONOURS** | twenty-three, ten named and thirteen to be found |
| 検 | **THE SURVEY** | what the record says — and what it refuses to guess at |
| 具 | **THE QUARTERMASTER** | export, import, the five camps, still air, sound |

`N` plant · `Q` dispatch · `H` `G` `F` `S` `T` `A` surfaces · `/` or `⌘K` the order book · `Esc` out.

The war table is one listbox: arrow keys walk the field, `Enter` opens what they landed on.

## What it inherits

This replaces a single 852-line `index.html` styled as a nautical almanac (preserved at `a3cafde`).
The visual system is gone; the arithmetic is not. `perWeek`, `paceGap`, the `BEHIND = 0.10`
threshold and the figure formatting were ported verbatim, and the old app's own `demo()` assertions
are now real tests. Any `goals.v1` data in your browser is detected and migrated on first load —
**copied, never moved**.

## Documentation

| | |
|---|---|
| [`PRODUCT.md`](PRODUCT.md) | what it is, who it is for, the principles and the constraints |
| [`DESIGN.md`](DESIGN.md) | the canonical design specification, and what four judged art directions killed |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | the shape of the code, the three rules, how to add to it |
| [`DATA-MODEL.md`](DATA-MODEL.md) | tables, invariants, the v1 migration, backup and repair |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Vercel, the bundle, and what would break it |

## Three rules worth knowing before you edit

1. **The domain layer imports nothing.** Every rule about where you stand is a pure function.
2. **Every mutation writes an event, and every event knows what caused it.** Momentum, rank,
   streaks, honours and the whole chronicle are folds over one log. Nothing derived is stored
   twice, and everything one act produced carries that act's id — which is what lets a dispatch be
   taken back completely rather than approximately.
3. **Behind is never failure.** The product reports a distance and never scolds. There is no copy
   anywhere for having fallen short, and a quiet month is the quietest the interface ever gets.
4. **No screen has to behave correctly for the record to stay sound.** Parent cycles, one-sided
   ties, a target of zero, a gate marked passed above a figure that came back down — every shape
   that must be impossible is refused in one place, `domain/invariants.ts`.

## Stack

Vite · React 19 · TypeScript (strict) · Zustand · Dexie · Zod · React Three Fiber (lazy) · Vitest ·
Playwright. Installable, and offline once loaded.
