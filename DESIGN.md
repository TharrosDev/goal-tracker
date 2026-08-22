# Design

Recorded from the built page, not from intention. `index.html` is the whole system.

## The world

**The Almanac.** A goal is a predicted arrival, so the page is the reference volume that predicts
arrivals — a nautical almanac crossed with Admiralty chart convention. It refuses the arrangement this
category always ships: no rounded cards, no donut charts, no pill-shaped progress bars, no soft shadows
standing in for structure.

The governing idea is that **the figures are the content** and everything else is the ruling that makes
them readable. Structure comes from hairlines and a continuous sheet, never from boxes.

## Color

Two inks on stock, plus one reserved signal. Strategy is **Committed**: the chart blue owns the frame,
masthead, and footer — roughly a third of the surface — and the sheet owns the middle.

| Token | Value | Role |
|---|---|---|
| `--deep` | `#0d2440` | Chart blue. Page ground, masthead band, footer. |
| `--deeper` | `#081a30` | Scrollbar track. |
| `--ink` | `#0a1c30` | The press's black. All primary text, rules, fills, buttons. |
| `--sheet` | `#e9e7dd` | Chart stock. The one continuous entry sheet. |
| `--sheet-2` | `#d5d1c1` | The sheet's cut edge (a 3px bottom offset, not a glow). |
| `--rule` | `#b0aa98` | Scale track, tick marks, input underlines. |
| `--hair` | `#c6c1b0` | The hairline dividing entries. |
| `--dim` | `#665f4e` | Secondary ink. Tinted from the stock's hue, never gray. |
| `--on-deep` | `#f0eee6` | Primary text on blue. |
| `--on-deep-dim` | `#9db2c9` | Secondary on blue. Tinted from the blue, never gray. |
| `--signal` | `#c8175a` | **Caution only.** See the rule below. |

### The magenta rule

Real charts reserve magenta for lights, warnings, and cautions. This page keeps that discipline
absolutely: `--signal` may only mark a caution, and nothing else on the page is permitted to use it.
A caution is one of three things:

- a deadline **14 days out or nearer**, or **due today**, or **overdue**;
- a money goal that is **materially behind pace** — `BEHIND = 0.10`, meaning it has fallen more than ten
  points of target behind the straight line from creation to deadline.

The tolerance exists because scarcity is the whole mechanism. An early draft flagged anything at all
behind the pace line, which lit three of four entries magenta and made the signal worth nothing. Two
points behind on day 21 of 122 is noise; ten points is a hazard.

A flagged entry earns a 4px magenta bar in the sheet's left margin, so cautions are findable by scanning
the left edge alone without reading a figure.

Measured contrast on the built page: body 13.9:1, all secondary ink 5.1:1, all on-blue text 7.2:1,
caution text 4.6:1. Everything clears 4.5:1.

## Type

**Archivo**, one variable family, embedded as a base64 woff2 inside the file — the page must work with no
network. Both axes carry real load:

- `font-stretch: 118%` — masthead wordmark, expanded like an official publication's title.
- `font-stretch: 104%` — entry names.
- `font-stretch: 78%` — every label, in caps at `letter-spacing: 0.16em`.
- `font-stretch: 100%` — figures and body.

Scale: **74 / 33 / 31 / 19 / 17 / 15 / 13**. Wordmark, entry name, figure, form input and arrival date,
body, standing line, label.

Every number carries `font-variant-numeric: tabular-nums lining-nums`, so figures align on the decimal in
a column and counting animations cause no layout shift. Table figures always show two decimals
(`fig()`); tick and standing-line figures drop empty decimals (`compact()`). The `$` is set at `0.58em`
and dimmed so it never competes with the amount.

Dates are `01 Dec 2026` — day first and zero-padded, so a column of them aligns.

## Components

- **Masthead** — full-bleed blue, wordmark left, "standing as of" date right, a thick-over-thin double
  rule beneath (almanac convention), then the standing line: open count, money saved against total, and
  time to the next arrival.
- **Sheet** — one continuous buff field, `max-width: 1180px`, entries divided by hairlines rather than
  separated into cards. Its only depth is a 3px cut edge plus one soft offset shadow.
- **New entry** — a printed form. The type toggle leads, because it governs whether the target field
  exists. Inputs are baseline-ruled blanks (`border-bottom` only), never boxes.
- **Entry** — name and class left, arrival date and days-out right, marginalia buttons far right; then a
  3- or 4-column figure table under a hairline; then the scale.
- **Scale bar** — the signature graphic. A 1px track with tick marks at quarters, labelled with real
  target fractions; a 3px ink run showing ground covered; and a solid triangular position marker.
  It carries no value label — the Current column already states the amount, and repeating it both
  duplicated the figure and collided with the table.
- **Checkbox** — a drawn 27px form box with a clip-path tick. A real `<input>` underneath.
- **Recorded** — completed entries below a 3px rule, struck through, set smaller. Filed, not greyed out.
- **Legend** — the colophon states the magenta rule and the scale reading, so a stranger shown the screen
  can orient without being told.

## Motion

**One authored moment:** logging an amount. The position marker travels to its new station while the
Current and Remaining figures climb with it, over 620ms on `cubic-bezier(.16,1,.3,1)`.

The animation is decoration; the state change is not. A timer owns the commit
(`setTimeout(settle, dur + 90)`) and the rAF loop only paints on the way there — a throttled or
backgrounded tab would otherwise starve `requestAnimationFrame` and leave the row stale until reload.

The run animates on `transform: scaleX()`. The marker offsets on `left`; a full-width element translated
by 100% doubles the track and pushes the sheet into horizontal overflow.

One page-level entrance (the sheet rises 10px) under `prefers-reduced-motion: no-preference`. All
transitions are disabled under `reduce`, and the travel resolves instantly there.

## Browser surfaces

Themed rather than left at defaults: `::selection` (inverted per ground), `caret-color`, the webkit
scrollbar, and `:focus-visible` at 2px with 3px offset — ink on the sheet, sheet on the blue.

## Icons

Two authored SVGs at `stroke-width: 1.6`, `stroke-linecap: square`, matching the hairline language: an
amend mark and a strike mark. No unicode glyphs anywhere.

## Responsive

Desktop-first, per PRODUCT.md. At ≤900px the gutter halves, the form collapses to two columns with the
name and submit spanning, figure tables go to 2×2, and middle tick labels drop. At ≤620px the arrival
line moves below the name. Verified with no horizontal overflow at 390px, 620px, 900px, and 1440px,
including with seven-figure amounts and a wrapping title.

## Constraints this system must keep

Single static `index.html`. No build, no framework, no dependency, no network request at runtime.
Everything above ships in that one file, including the font.
