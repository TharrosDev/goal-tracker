# THE CAMPAIGN — canonical design specification

Register: **Sengoku war camp.** Script: **kanji as marks, English as text.** Metaphor: **deep.**
Worlds: **five camps**, one authored family.

This document is the only design authority. An engineer or an agent with no other context builds the
interface from this file. Where it conflicts with an older screenshot, a comment, or a habit, this
file wins.

---

## 0. HOW THIS SPECIFICATION WAS ARRIVED AT, AND WHAT IT KILLED

Four independent art directions were authored against this register and each was attacked by two
hostile judges — one hunting genericness and pastiche, one hunting unbuildability and inaccessibility.
All four proposals scored between 4 and 6 out of 10. They failed in the same two ways, and this
specification exists because of those two findings. **Do not reintroduce what they killed.**

**Finding one — the skeleton was a dashboard in every case.** Strip the lacquer and the wireframe was
always: icon rail → hero metric → 56-column bar chart → horizontally scrolling card carousel →
activity feed. That is what a generator emits for "goal tracker dashboard," and no amount of gold leaf
changes it. A material layer is a coat. It cannot rescue a panelled composition.

**Finding two — the signature encodings were invisible.** Dark-on-dark lacquer relief computed to
1.07–1.35:1 where WCAG 1.4.11 requires 3:1 for any graphic that carries meaning. Progress as filling
lamellar plates: 1.10:1. Progress as goal-hue at 14% over near-black: 1.08:1. An engraved momentum
numeral: unrenderable in two of five worlds. The proposals each had a beautiful idea that could not be
seen.

Also killed, and not to return:

- **`--radius: 0` is not an anti-card defence.** It prevents rounded cards, not card _structure_. A
  480px right-hand detail drawer is a drawer; a horizontally scrolling row of objects is a carousel.
- **A hero metric is still a hero metric** however large the numeral.
- **Length-encoded bars with the axis deleted are still a bar chart**, and one that has lost its scale
  reference while keeping its encoding — strictly worse than an honest chart.
- **Continuous 360° goal hue.** `hueOf()` spread goals across the whole wheel, which put a money goal
  six degrees from `--ok` and a deadline goal on top of `--caution`, inside a palette whose thesis is
  that colour is scarce. Identity by free hue is dead. See §4.4.
- **Vertical Latin as a load-bearing treatment.** `line-height` does not compress glyph advance under
  `writing-mode: vertical-rl` — it sets the line box's cross-size. The proposals' signature titles fit
  nine characters where they truncated at eighteen: wrong by a clean factor of two, at every
  breakpoint.
- **Marching-squares contour terrain.** Contours are European survey cartography (Cruquius 1727) that
  reached Japan with the Meiji Land Survey in the 1880s. Sengoku maps are pictorial _kuniezu_. The one
  element carrying the authorial claim was a GIS instrument with Japanese fittings bolted around it.
- **Purple for merit.** The proposed "murasaki" was the repo's existing `#8a6bff` with the saturation
  pulled down — the banned purple, wearing a history lesson. Merit is gold leaf. There is no purple.
- **A default world that is the old one renamed.** LACQUER as first proposed was chromatically the
  existing VOID world: same neutral near-black, same amber accent, within 0.2 of the same ratios.

---

## 1. THESIS

**The product is one continuous field, not a page of panels.** Time runs left to right across the
whole viewport: the left edge is today, the right edge is the horizon. Progress rises from the ground
line. A single diagonal — **the line** — is drawn once across the entire field and shows where every
campaign _should_ stand by now, so being behind is a visible vertical distance rather than a number to
read. Momentum is **the wind**, one environmental force that moves everything on screen at once, so a
strong month is legible before a single figure is read.

It is unashamedly an _instrument_: it has scale bars, day-marks, a horizon and a ground. It is not a
dashboard because it has no panels. There is one space, and everything in the product is a position, a
height, or a force inside it.

> **The test for whether a screen belongs in this product:**
> _Can you delete a rectangle from it without breaking a spatial relationship?_
> If yes, that rectangle is a panel, and it does not belong.

The war table and the campaign map are **the same object at two zoom levels**, which is why the map
cannot be decorative — it is the home screen, pulled back.

---

## 2. NOMENCLATURE

Every kanji is `aria-hidden="true"` and always accompanied by its English. No meaning is ever carried
by a mark alone. See §14.1.

| Internal              | Shown in product      | Mark | Why                                                       |
| --------------------- | --------------------- | ---- | --------------------------------------------------------- |
| command centre / home | **THE WAR TABLE**     | 陣   | the encampment where the field is read                    |
| goal universe         | **THE CAMPAIGN**      | 戦   | the same field pulled back to every standard ever planted |
| goal                  | **A STANDARD**        | 旗   | a banner planted in the ground; the product's only object |
| sub-goal              | **A DETACHMENT**      | 隊   | a body under a standard                                   |
| boss goal             | **A SIEGE**           | 城   | a castle takes seasons, not afternoons                    |
| milestone             | **A GATE**            | 門   | a thing you pass through on the way                       |
| progress entry        | **A DISPATCH**        | 報   | a report from the field                                   |
| the pace reference    | **THE LINE**          | 線   | where you should stand by now                             |
| deadline              | **THE HOUR**          | 刻   |                                                           |
| focus mode            | **THE DOJO**          | 道場 | one opponent, one technique, nothing else in the room     |
| trophy room           | **THE SHRINE**        | 社   | finished things are enshrined, not archived               |
| time machine          | **THE CHRONICLE**     | 記   |                                                           |
| achievements          | **HONOURS**           | 誉   |                                                           |
| analytics             | **THE SURVEY**        | 検   |                                                           |
| level                 | **RANK**              | 位   |                                                           |
| XP                    | **MERIT**             | 功   | a recorded meritorious deed                               |
| momentum              | **THE WIND**          | 風   | a force, not a score                                      |
| streak                | **THE UNBROKEN**      | 連   |                                                           |
| settings / data       | **THE QUARTERMASTER** | 具   | where supply, backup and repair live                      |
| completion ceremony   | **THE SEALING**       | 印   |                                                           |
| the five worlds       | **CAMPS**             | 営   |                                                           |
| reduced motion        | **STILL AIR**         | —    | authored still compositions; facts remain available                      |

Route paths stay plain English (`/campaign`, `/standard/:id`, `/dojo`, `/shrine`, `/chronicle`,
`/honours`, `/survey`, `/quartermaster`) so the URL bar is never a puzzle.

---

## 3. RANK LADDER

Rank advances every four levels, matching `TITLES[Math.floor((level - 1) / 4)]` already in
`src/domain/xp.ts`. Replace the existing array with these ten.

| Levels | Rank        | Mark |
| ------ | ----------- | ---- |
| 1–4    | ASHIGARU    | 足軽 |
| 5–8    | KUMIGASHIRA | 組頭 |
| 9–12   | SAMURAI     | 侍   |
| 13–16  | HATAMOTO    | 旗本 |
| 17–20  | MONOGASHIRA | 物頭 |
| 21–24  | BUGYŌ       | 奉行 |
| 25–28  | TAISHŌ      | 大将 |
| 29–32  | SHUGO       | 守護 |
| 33–36  | DAIMYŌ      | 大名 |
| 37+    | SHŌGUN      | 将軍 |

Rank is never a comparison against another person, because there is no other person. It is a record of
your own accumulated merit and nothing else.

---

## 4. COLOUR

### 4.1 The binding rule

**Every value the interface encodes must clear 3:1 against whatever it sits on, and every piece of
text must clear 4.5:1.** This is enforced by `src/design/contrast.test.ts`, which computes every
foreground/background pair in every camp and fails the build. Relief, sheen, lacquer depth and grain
are a **richness layer**: they may enrich a channel, and they may never be the only carrier of one.

That rule is what killed the first four proposals, and the test exists so it cannot come back.

### 4.2 LACQUER — the default camp

Kachi-iro: the indigo-black of victory-dyed armour. Blue-shifted and warm-inked, so it is not the
neutral near-black of every dark UI, and specifically not the world it replaces.

| Token             | Value                   | Ratio on `--ground` | Meaning-rule                                           |
| ----------------- | ----------------------- | ------------------- | ------------------------------------------------------ |
| `--ground`        | `#0C1018`               | —                   | the lacquer field                                      |
| `--ground-raised` | `#151B27`               | —                   | anything standing on the field                         |
| `--ground-inset`  | `#06080D`               | —                   | anything cut into it                                   |
| `--ground-scrim`  | `rgba(6,8,13,.88)`      | —                   | overlay backing                                        |
| `--ink`           | `#F2EDE1`               | 16.4:1              | gofun bone. All primary text.                          |
| `--ink-dim`       | `#A9A294`               | 7.6:1               | secondary text, undyed hemp                            |
| `--ink-faint`     | `#8A8474`               | 5.1:1               | labels. **Floor: nothing dimmer exists.**              |
| `--rule`          | `rgba(242,237,225,.16)` | —                   | structure                                              |
| `--rule-strong`   | `rgba(242,237,225,.38)` | —                   | the line, the ground                                   |
| `--rule-hair`     | `rgba(242,237,225,.09)` | —                   | day-marks                                              |
| `--accent`        | `#C8A24A`               | 8.0:1               | **kin.** Gold leaf. Merit, rank, active, and the seal. |
| `--ok`            | `#7FB069`               | 7.6:1               | **moegi.** Ahead of the line.                          |
| `--warn`          | `#D08B3C`               | 6.8:1               | **kuchiba.** The hour approaches.                      |
| `--caution`       | `#E2482B`               | 4.7:1               | **shu.** Vermilion. See 4.3.                           |
| `--merit`         | `= --accent`            | 8.0:1               | merit is gold leaf. There is no purple.                |

**State tokens.** `--state-new: #7FB069` · `--state-active: #C8A24A` · `--state-critical: #E2482B` ·
`--state-stalled: #8A8474` · `--state-paused: #8A8474` · `--state-completed: #F2EDE1`.

### 4.3 What vermilion is for

`--caution` marks exactly three things: an hour that has passed, an hour inside a fortnight, and a
standard materially behind the line (`paceGap > BEHIND`, i.e. more than ten points). Nothing else in
the product may use it — not a delete button, not an error toast, not a decorative accent.

It is scarce so that it is loud. Inherited directly from the v1 almanac, where the same discipline
governed magenta.

**And it never means failure.** Behind is normal, expected, and reported as a distance. See §10.

### 4.4 Identity is not free colour

`hueOf()` currently spreads goals across the entire hue wheel. It is replaced by `dyeOf()`, returning
one of **six indigo-family dyes** — the colours a unit was actually identified by — selected from the
goal's `category` (hashed), falling back to `kind`.

| Token     | Value     | Ratio | Dye                  |
| --------- | --------- | ----- | -------------------- |
| `--dye-1` | `#5B7FA6` | 5.0:1 | ai — common indigo   |
| `--dye-2` | `#86A0BE` | 7.4:1 | usu-ai — pale indigo |
| `--dye-3` | `#4E8C8C` | 5.4:1 | ai-midori            |
| `--dye-4` | `#7B6FA8` | 4.6:1 | ai-murasaki          |
| `--dye-5` | `#45789A` | 4.3:1 | hanada               |
| `--dye-6` | `#9AAFC4` | 8.9:1 | shira-ai — bleached  |

A goal with no category flies **undyed hemp** (`--ink-dim`). Dye is a weak channel by design: the
strong identity channel is the **mon** (§7) and the **stencil** cut into the cloth. Colour outside the
indigo family always means state, never identity — so nothing a person chooses can ever collide with
something the system is trying to tell them.

### 4.5 The other four camps

Same token names, different values. Every camp is put through the same contrast test; no camp inherits
a colour from LACQUER implicitly.

**WASHI** — paper day. `--ground: #E8E1CE` · `--ground-raised: #F3EEE0` · `--ground-inset: #D6CDB6` ·
`--ink: #17140E` · `--ink-dim: #4E4738` · `--ink-faint: #6A6252` (4.8:1) · `--accent: #8A6A1E` ·
`--ok: #2F6B3C` · `--warn: #8A5510` · `--caution: #B32617`. Rules are ink at 0.22/0.5/0.12. Dyes darken
to the `#2E4E70`–`#4A6B88` band. `--glow: none`. Grain up, scanlines off.

**SUMI** — ink monochrome. `--ground: #EDE9DE` · `--ink: #14120F` · every state colour becomes a
neutral (`--state-critical: #14120F` at full weight, `--state-stalled: #7C766A`), and **the only colour
in the camp is `--caution: #C0392B`**, the seal. State is carried entirely by form (§10), which is what
makes SUMI the proof that the form language works.

**KURO** — cinema. `--ground: #000000` · `--ground-raised: #141414` · `--ink: #FFFFFF` ·
`--ink-dim: #B8B8B8` · `--ink-faint: #8C8C8C` (5.6:1). Every state token is a grey step:
new `#FFFFFF`, active `#D9D9D9`, critical `#FFFFFF` **with a doubled rule**, stalled `#8C8C8C`. KURO is
the canary: if you cannot tell a critical standard from an active one here, the _form_ is wrong and
gets fixed for every camp.

**JIGOKU** — the hell-screen. `--ground: #14060A` · `--ink: #FFF2E8` · `--accent: #FFC53D` ·
`--ok: #A8E05F` · `--warn: #FF8A00` · `--caution: #FF2E2E`. Grain and scanlines at maximum, wind
amplitude ×1.6. Offered, never defaulted to.

---

## 5. MATERIAL

Every technique below is CSS or SVG, produced on device, with no network request and no raster asset.
Cost is stated. **Nothing in the "animate" column may carry a value a person needs to read.**

| Material         | Technique                                                                                                                                                                                                                       | Cost                                                                   | Animate?                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------- |
| Lacquer ground   | three stacked backgrounds on `.ambient`: base `--ground`; a `radial-gradient(120% 90% at 22% -8%)` at 0.05 bone for the wet curve; a pointer-anchored sheen `radial-gradient(60% 40% at var(--sheen-x) var(--sheen-y))` at 0.04 | paint-once + one custom-property write per pointer move, rAF-throttled | sheen only                 |
| Grain            | `radial-gradient(circle, var(--ink) .5px, transparent .6px)` at `background-size: 3px 3px`, opacity `--grain-opacity`                                                                                                           | free                                                                   | no                         |
| Hemp weave       | two `repeating-linear-gradient`s at 0°/90°, 2px period, 0.03 alpha                                                                                                                                                              | free                                                                   | no                         |
| Hammered iron    | one 256px value-noise tile baked to an `OffscreenCanvas` at boot, `toDataURL()` into `--tex-iron`                                                                                                                               | ~4ms once, at boot                                                     | no                         |
| Gold leaf        | `background: linear-gradient(104deg, #8A6216, #E8C46A 38%, #FFF0C2 46%, #C8A24A 55%, #8A6216)` with `background-size: 220%`, plus a `mask-image` of the leaf-seam tile                                                          | free                                                                   | position only, in ceremony |
| Seam of leaf     | inline `data:image/svg+xml` mask, irregular quadrilaterals                                                                                                                                                                      | free                                                                   | no                         |
| Katazome stencil | inline SVG `<pattern>` generated from the goal id (§7), stroked in the goal's dye                                                                                                                                               | free                                                                   | no                         |
| Vermilion seal   | SVG path with `filter: url(#broken-ink)` — one `feTurbulence` + `feDisplacementMap`, **applied to a static element only**                                                                                                       | ~1ms, paint-once                                                       | no                         |
| Cord / lacing    | `repeating-linear-gradient(-58deg, …)` at a 5px period inside a 6px column                                                                                                                                                      | free                                                                   | no                         |
| Scanlines        | `repeating-linear-gradient(to bottom, var(--ink) 0 1px, transparent 1px 3px)` at `--scanline-opacity`                                                                                                                           | free                                                                   | no                         |
| Dust in the air  | 1 canvas, ≤120 particles at `--wind` amplitude, `visibilitychange`- and `IntersectionObserver`-gated                                                                                                                            | ~0.4ms/frame desktop; disabled on `pointer: coarse` and in STILL AIR   | yes                        |

**Two standing prohibitions, both from the judges.** `clip-path` discards outer `box-shadow`, so a
chamfered edge and a drop bevel are mutually exclusive on one element — use an inner wrapper if you
need both. And `filter:` on a moving or scrolling element is banned outright; every SVG filter in this
product is applied to something that does not move.

---

## 6. TYPE

The scale in `src/design/type.css` stands: labels at 11.5px, body at 19px, and those are floors, not
targets. Archivo's **width axis is the system**; weight is secondary.

| Role           | Family          | Size               | `wdth` | `wght` | Notes                              |
| -------------- | --------------- | ------------------ | ------ | ------ | ---------------------------------- |
| Label          | JetBrains Mono  | `--t-label` 11.5px | —      | 500    | uppercase, `0.14em`, `--ink-faint` |
| Body           | Archivo         | `--t-body` 19px    | 100    | 400    |                                    |
| Standard title | Archivo         | `--t-h3`           | 92     | 650    | **horizontal, always**             |
| Section        | Archivo         | `--t-h2`           | 84     | 650    | uppercase                          |
| Figure         | Archivo         | `--t-h1`           | 76     | 700    | tabular                            |
| The one number | Archivo         | `--t-mega`         | **62** | 800    | tabular, `-0.045em`                |
| Kanji mark     | SVG path, drawn | —                  | —      | —      | never a font; see §7.3             |

**Vertical setting is confined to two places**: the left rail's route label, and a single word never
longer than eight characters. It uses `writing-mode: vertical-rl; text-orientation: upright` with a
**20px floor**, and it never carries a goal title. The earlier direction's vertical titles were out by
a factor of two because `line-height` sets the line box's cross-size in vertical writing modes, not the
glyph advance; budget one full em of column height per glyph and nothing less.

**The one number.** Exactly one numeral per screen may be set at `--t-mega`. On the war table it is the
wind. In a standard it is that standard's own figure. Two mega numerals on one screen is a bug.

---

## 7. THE MON SYSTEM

Every standard flies a crest nobody had to draw, generated from what `src/domain/identity.ts` already
produces: `rings[]` (count, radius, rotation, shape), `symmetry`, `weight`, `callsign`.

### 7.1 Drawing algorithm

Render into a `viewBox="-50 -50 100 100"` SVG, one `<svg>` per standard, no filters.

1. **Enclosure.** `goal.kind` selects one of ten outlines, drawn as a path at r=46, stroke 2:
   circle (money) · square (numeric) · hexagon (percentage) · rounded-square with a notch (habit) ·
   double circle (streak) · pentagon (project) · diamond (deadline) · triangle (milestone) ·
   octagon (countdown) · circle-in-square (custom). **Kind is readable from silhouette alone**, which
   is what makes SUMI and KURO work.
2. **Rings.** For each ring, place `ring.count` marks evenly on a circle of radius `ring.radius * 40`,
   rotated by `ring.rotation`, mirrored to `symmetry`-fold rotational symmetry. Shape per ring:
   `dot` → r=3 filled · `bar` → 2×9 rect pointing at centre · `notch` → 6-long stroke-2 line.
3. **Centre.** A filled disc of radius `weight * 9`, so difficulty is legible at the crest's core.
4. **Fill.** Marks and enclosure both take the goal's dye (§4.4). Undyed goals take `--ink-dim`.

Deterministic, identical across devices and exports, forever. Two goals differ visibly in silhouette
(kind), mark pattern (id), and core size (difficulty), before dye is considered at all.

### 7.2 State on the mon

Progress and state modify the crest, never replace it:

- `fraction` fills the enclosure from the bottom via a `<clipPath>` at `--ink` at 18% — a _secondary_
  reading, since the primary one is the standard's height (§8).
- **new** — enclosure dashed `4 3`.
- **active** — enclosure solid.
- **critical** — enclosure doubled: a second path at r=50, stroke 1.
- **stalled** — every mark drops to `--state-stalled` and the enclosure gains a 1px inward offset,
  reading as shrinkage. Nothing blinks, nothing reddens.
- **paused** — marks removed entirely, leaving the enclosure and the lacing holes: visibly _unlaced_.
- **completed** — enclosure and marks in gold leaf, with the vermilion seal struck across the
  lower-right at 22°.

### 7.3 Kanji marks

The product uses **27 kanji**, listed in `src/design/marks.ts`. They are set in a subset of Noto
Serif JP — Mincho, so they read as carved and stamped rather than typed — cut to exactly those 27
glyphs by `scripts/subset-marks.mjs`. The full face is 1.38MB; the subset is **6.8KB**, ships in the
bundle, and works offline.

An earlier draft called for drawing each kanji as an SVG path to avoid the font weight. That was the
wrong trade: 7KB is not worth twenty-seven hand-drawn approximations of characters that have correct
forms. The subset script reads the glyph list out of the registry, so the font and the code cannot
drift.

Every mark is rendered by `<Mark>`, which emits the kanji `aria-hidden="true"` alongside its English
string. **A mark alone is never a label, a button, an accessible name, or a status.** Deleting every
mark from the product must leave it fully operable and fully understood.

## 8. THE WAR TABLE

### 8.1 The coordinate system

The field is one element filling the viewport below the rail.

- **X — elapsed span.** A standard's horizontal position is how far it is through
  **its own** span: 0 the day it was planted, 1 at its hour. Standards drift rightward on their own
  as time passes and reach the right edge at their hour. The field is a race toward that edge.
- **Y — the ground.** Cloth rises from a ground line at 88% of the field height (`--ground-line`).
  Height is `fraction` of the usable space. Full height means finished.
- **THE LINE.** One 1px `--rule-strong` diagonal from (left edge, ground) to (right edge, top).

**Why X is elapsed span and not days-until-the-hour.** Because it makes the line _exact_. At
horizontal position x the expected progress is exactly x, so a standard sitting on the line is
precisely on pace, one above it is ahead, and the vertical gap below it **is `paceGap`, to the pixel,
for every goal regardless of span**. Plotting absolute days against a shared horizon reads well but
the diagonal is then only correct for goals whose whole span happens to equal the horizon — the most
prominent element in the product would have been an approximation dressed as a measurement.
`src/field/layout.test.ts` asserts the equivalence for a ten-day span and a ten-year one.

Absolute time is not lost: every standard carries its own arrival text (`12 DAYS`, `3 DAYS PAST THE
HOUR`), which is where a date actually belongs.

- **Behind.** When `paceGap > BEHIND` — the inherited ten-point threshold — the gap between cloth top
  and line is hatched at 6px in `--caution` at 0.5 alpha. That is the only place the field goes red,
  and it reports a distance, never a judgement.
- **THE RESERVE.** Standards with no hour have no x. They are planted in a band below the ground
  line, heaviest first. Not lesser; simply not on a clock, which is where an army keeps what it has
  not yet committed.
- **Displacement is reported, never hidden.** When standards crowd the same position they are nudged
  apart to stay legible, but each keeps its true datum (`centre`), and the tick on the scale bar is
  drawn from the datum rather than from where the cloth had to be moved.

Everything else on the war table is a position, a height, or a force in that one space. There is no
panel to delete.

### 8.2 What else is on it

- **THE WIND**, top-left, overlapping the field: the momentum figure at `--t-mega`, `wdth 62`, its
  baseline sitting 24px _below_ the scale bar so it crosses it. Beneath it, one line:
  `RISING · 11 OF 14 DAYS` or `STILL · 3 OF 14 DAYS`. Its 56-day energy series is **not** a bar chart:
  it is the wind itself, driving the sway of every standard in the field (§11).
- **RANK**, top-right, vertically set: the rank word, the level as a Roman numeral, and a 2px gold
  merit rule whose length is `progression.fraction`.
- **THE ORDER OF THE DAY**, bottom-left, three lines of `--t-body`: the streak, the count of standards
  standing, and the next hour. Plain sentences, not statistics.
- **Nothing else.** No feed, no carousel, no list. Recent dispatches live in THE CHRONICLE.

### 8.3 Desktop wireframe

```
┌ 64px rail ┬──────────────────────────────────────────────────────────────────┐
│  陣 WAR   │ PLANTED                ELAPSED SPAN                  THE HOUR  │
│  戦 CAMP  │ ·│···│···│···│···│···│···│···│···│···│···│···│···│···│···│···│··  │  scale
│  道 DOJO  │                                                                  │
│  社 SHRI  │   74          ╲                                        位 RANK   │
│  記 CHRO  │   ▔▔▔▔▔▔▔▔▔▔▔▔▔╲                                     SAMURAI IX  │
│  誉 HONO  │   THE WIND      ╲  the line                          ▔▔▔▔▔▔▔     │
│  検 SURV  │   RISING         ╲                                               │
│           │   11 OF 14 DAYS   ╲      ▟▙                                      │
│           │                    ╲     ██  ← cloth top above the line: ahead   │
│           │            ▟▙       ╲    ██                        ▟▙            │
│           │            ██  ▨▨▨▨▨▨╲   ██                        ██            │
│           │            ██  ▨ hatched: behind by more than ten  ██            │
│           │            ██        ╲   ██                        ██            │
│  具 QUAR  │  ──────────██─────────╲──██────────────────────────██─────────   │ ground
│           │            ◈ RB       ╲  ◈ EF                      ◈ AT          │ mon
│           │  RESERVE   ░░ FRENCH DAILY    ░░ READ 30 BOOKS                   │
│           │  UNBROKEN 11 DAYS · 6 STANDING · NEXT HOUR IN 12 DAYS            │
└───────────┴──────────────────────────────────────────────────────────────────┘
```

### 8.4 Mobile (390px) — a different instrument, not a squeeze

The field does not scale down; it **rotates**. Time runs _top to bottom_ (nearest hour first) and
progress fills each standard left to right, because a phone is tall and a thumb travels vertically.

```
┌────────────────────────────────┐
│ 陣 THE WAR TABLE          位 IX│
├────────────────────────────────┤
│  74                            │  the wind, --t-mega
│  ▔▔▔▔▔▔  RISING · 11 OF 14     │
├────────────────────────────────┤
│ ◈ ROAD BIKE           12 DAYS  │
│ ███████████████░░░░░░░░│░░  74%│ ← │ is the line
│ ─────────────────────────────  │
│ ◈ EMERGENCY FUND      ▲ 3 OVER │
│ ████████▨▨▨▨│░░░░░░░░░░░░  31% │ ← hatch: behind
│ ─────────────────────────────  │
│ ◈ FRENCH DAILY        RESERVE  │
│ ███████████████████████░░  88% │
├────────────────────────────────┤
│  陣    戦    ＋    道    記     │ bottom nav, 44px+
└────────────────────────────────┘
```

Swipe left/right moves between the war table, the campaign, the dojo and the chronicle. Swipe right on
a standard opens a dispatch field with the numeric keypad already up — **logging progress on a phone is
two taps and a number, and no ceremony is allowed to slow it down.**

---

## 9. THE GOAL AS AN OBJECT

A standard, everywhere it appears. Every part is a data channel; nothing is ornament.

| Part           | Encodes                    | Rendering                                              |
| -------------- | -------------------------- | ------------------------------------------------------ |
| Pole           | —                          | 2px `--rule-strong`, full height of the cloth          |
| Width          | `weight`                   | `56 + weight * 120` px, gapless against its neighbours |
| Cloth height   | `fraction`                 | rises from the ground line                             |
| Cloth fill     | `dye`                      | flat, ≥4.3:1, plus the katazome stencil at 0.5 alpha   |
| Cloth top edge | state                      | solid / dashed / doubled / absent — see §10            |
| Mon            | identity, kind, difficulty | 44px at the pole's foot, below the ground line         |
| Callsign       | identity                   | 11.5px mono under the mon, `--ink-faint`               |
| Gate ticks     | milestones                 | 8px brass marks on the pole at each milestone's `at`   |
| Seal           | completed                  | vermilion, struck at 22° across the lower cloth        |

**Two goals, worked.** _ROAD BIKE_ — money, difficulty 2, priority 3, category SAVINGS, weight 0.44,
fraction 0.74: a 109px standard, cloth three-quarters up, circle mon with a small core, ai dye, one
gate tick passed. _SHIP THE ATLAS RELEASE_ — project, difficulty 5, priority 5, boss, weight 0.92,
fraction 0.31, critical: a 166px standard, cloth barely a third up and hatched to the line, pentagon
mon with a large core and a doubled enclosure, ai-murasaki dye, five gate ticks of which one is passed.
They are different objects at a glance, in every camp, in monochrome.

---

## 10. STATE LANGUAGE

Three channels, in this order of authority: **form**, then **colour**, then **an English phrase**. The
kanji is fourth and decorative. If a state is not distinguishable in KURO with colour removed, its form
is wrong.

| State         | Form                                                                      | Colour              | Phrase                                           |
| ------------- | ------------------------------------------------------------------------- | ------------------- | ------------------------------------------------ |
| **new**       | cloth top dashed `4 3`, mon enclosure dashed                              | `--state-new`       | `PLANTED TODAY`                                  |
| **active**    | cloth top solid                                                           | `--state-active`    | `74% · 12 DAYS`                                  |
| **critical**  | cloth top **doubled** (two 1px rules, 3px apart), gap to the line hatched | `--state-critical`  | `THE HOUR IS IN 6 DAYS` / `3 DAYS PAST THE HOUR` |
| **stalled**   | cloth desaturated to 0, grain ×3, pole thins to 1px                       | `--state-stalled`   | `QUIET FOR 18 DAYS`                              |
| **paused**    | cloth **removed**, leaving pole and empty lacing holes                    | `--state-paused`    | `STRUCK, NOT ABANDONED`                          |
| **completed** | cloth full height in gold leaf, sealed                                    | `--state-completed` | `TAKEN, 3 DAYS EARLY`                            |

### Behind is never failure

This is a binding rule, inherited from the v1 product principles and enforced in copy review.

- The interface **reports a distance, never a judgement**. `31% · 40 POINTS BEHIND THE LINE`, never
  "you're falling behind."
- No red X, no downward arrow, no crossed-out anything, no "overdue" badge in a pill.
- `stalled` is the quietest state on screen, not the loudest. A quiet month _goes still_; it does not
  get shouted at.
- `paused` reads as a deliberate act — _struck_, the word for taking down a camp you intend to raise
  again — not as abandonment.
- Returning after silence is rewarded (`RECOVERY_XP`) and named: `RAISED AGAIN AFTER 34 DAYS`.

---

## 11. MOTION

The six words from `src/design/motion.ts`, expressed. Every one has a STILL AIR equivalent that is a
state change, not a deletion.

| Word         | Property                                                                               | Duration / easing                     | STILL AIR                                                  |
| ------------ | -------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| **ENTER**    | `clip-path` inset wipe upward from the ground + 12px rise                              | `--normal` 0.42s, `EASE.out`          | instant, final state                                       |
| **FORM**     | pole draws from ground to full height, then cloth unfurls `scaleY 0→1` from the top    | `--slow` 0.95s, `EASE.back`           | pole and cloth appear together, no scale                   |
| **SETTLE**   | registered `@property --fraction` animates the cloth height; the figure counts with it | `--travel` 0.62s, `EASE.out`          | value snaps; the figure still updates                      |
| **PRESSURE** | cloth `skewX` oscillating ±`pressure * 1.4deg`, period `2.4s - pressure`               | linear, infinite, ≥0.35 pressure only | no oscillation; the doubled top edge carries urgency alone |
| **DECAY**    | opacity 0.5↔0.62 and 2px drift over 7s                                                 | `easeInOut`, infinite                 | flat 0.55 opacity                                          |
| **RESOLVE**  | cloth collapses to the pole, then re-forms in gold leaf                                | 0.3s in, 0.95s out                    | crossfade to the gold state                                |

**THE WIND.** One `requestAnimationFrame` loop, one shared phase value, read by every standard as a CSS
custom property. Amplitude and rate come from `ambientFor(momentum)`. It is
`IntersectionObserver`-gated, stops on `visibilitychange`, and does not exist at all in STILL AIR. One
loop for the whole product; a per-standard animation is a bug.

**The wind is never the only carrier of momentum** — the figure is always on screen.

---

## 12. CEREMONY

Four tiers. Large ceremonies close with `Escape` or their visible close control; small tiers do not block input. **Skipping preserves the final state**, not
on a dismissal: the merit is awarded and the record written either way.

1. **A dispatch logged** — the cloth SETTLEs, the figure counts, a 40ms 2px lift on the standard. Under
   300ms. This must never feel expensive.
2. **A gate passed** — the brass tick strikes gold, a 12-particle burst at the tick, the gate's name
   rises and fades. ~900ms.
3. **A standard taken** — the standard RESOLVEs to gold leaf, the vermilion seal drops on with the
   broken-ink filter, merit counts up, and the standard travels out of the field toward the shrine.
   ~2.4s.
4. **A SIEGE FALLS** — a boss goal. Deliberately far too much. Eight beats, ~7 seconds, at
   `--z-ceremony`:

   1. `0.0s` The field drops to `--ground-inset` and every other standard **bows** — a −6° rotation
      about its socket on a 30ms left-to-right stagger. The camp acknowledges.
   2. `0.4s` THE LINE — the diagonal that has organised every screen since first load — thickens to
      3px, turns gold, and travels to the vertical centre.
   3. `0.9s` The castle is drawn: an SVG path, stroke-dashoffset animating over 1.1s.
   4. `2.0s` The castle's strokes break, tier by tier, from the top. Five beats, 120ms apart.
   5. `2.8s` The standard's title takes the screen at `--t-mega`, `wdth 62`, cropped by the viewport
      on both sides.
   6. `3.6s` Its own chronicle flashes behind the type: every gate, every long silence, every recovery,
      one per 60ms, as a scrubbing timeline.
   7. `4.8s` The seal lands. One 78Hz sine at 2.4s exponential decay if `settings.sound` — the entire
      soundtrack of this product is three oscillators and no audio files.
   8. `5.4s` The tally: days held, dispatches logged, gates passed, merit earned, honours unlocked, and
      the standard's permanent place in the shrine.

   **STILL AIR** gets a distinct, authored version: the eight beats become eight _stills_, advanced by
   `NEXT`, `Space` or `Enter`, with no automatic advance or motion between them. It is a printed record of the
   victory rather than a film of it, and it is not a lesser experience.

---

## 13. MOBILE

Its own environment (§8.4), not a narrower desktop.

- Bottom navigation, five destinations, 44px minimum targets, thumb-reachable.
- Horizontal swipe between top-level surfaces; swipe-right on a standard to log a dispatch.
- The campaign uses the list renderer by default on `pointer: coarse` — the WebGL scene is opt-in from
  the quartermaster, never the default on a phone.
- Dust and sheen are off. The wind survives at reduced amplitude because it is one shared loop.
- The one number stays at `--t-mega`; it is the thing worth the space.

---

## 14. ACCESSIBILITY

Binding. None of this is traded for an effect.

### 14.1 The kanji contract

Every kanji is `aria-hidden="true"` and rendered inside a component that also renders its English
string in the accessibility tree. No kanji is ever the accessible name of a control, the only content
of a heading, or the sole indicator of a state. Removing every mark from the product must leave it
fully operable and fully understood.

### 14.2 The rest

- **Contrast.** §4.1, enforced by a test that fails the build in all five camps.
- **Form before colour.** Every state distinguishable in KURO with colour removed (§10).
- **Keyboard.** Every surface fully operable. The field is a listbox: arrow keys move between
  standards, `Enter` opens, `L` logs a dispatch on the focused one. Shortcuts `N Q G H F T A / ⌘K Esc`.
- **Focus.** 2px `--accent` at 3px offset, unchanged in every camp so it is never hunted for.
- **Motion.** STILL AIR follows `prefers-reduced-motion` and is overridable in either direction from
  the quartermaster. It is a re-composition, not a subtraction.
- **Non-motion equivalents.** The wind figure is always on screen; pressure is carried by the doubled
  top edge; decay is carried by the phrase `QUIET FOR 18 DAYS`.
- **Targets.** 44px minimum, always.
- **Type.** Labels ≥11.5px, body ≥19px. Floors, not targets.
- **The field has a list.** `THE ROLL` renders the identical information as a semantic table, reachable
  by keyboard from the field and selected automatically under STILL AIR or without WebGL. It is a peer,
  not a fallback.

---

## 15. FORBIDDEN

Checkable against a diff.

1. **No panels.** If a rectangle can be deleted without breaking a spatial relationship, it is a panel.
   No sidebar, no drawer, no card, no bento cell, no carousel, no activity feed as a column.
2. **No hero metric with supporting stat tiles.** One mega numeral per screen, embedded in the field.
3. **No bar chart wearing a costume.** If length encodes a value, it gets an axis and a scale. The wind
   is not a chart; it is the force that moves the field.
4. **No value carried below 3:1**, and no text below 4.5:1, in any camp. Relief and lacquer enrich; they
   never carry.
5. **No free hue.** Identity is mon, stencil and one of six indigo dyes. Colour outside that family
   means state.
6. **No purple.** Merit is gold.
7. **No vertical Latin** outside the rail and single words ≤8 characters, never below 20px, never a
   goal title.
8. **No contour lines, no coordinate grid, no decorative grid-field background.** Ruling belongs to an
   instrument that is actually measuring: the scale bar, the ground, the line.
9. **No `filter:` on a moving element.** No permanent render loop except the single shared wind, which
   is visibility-gated.
10. **No cherry blossom, no katakana as texture, no dragon, no torii, no "zen".** The register is a war
    camp in the 1570s, not a restaurant menu.
11. **No shaming.** No red X, no downward arrow, no "overdue" pill, no streak-loss punishment. Report
    the distance.
12. **Nothing invented.** Every figure on screen traces to a real value in `src/state/selectors.ts`.
    No placeholder data, no decorative chart, no metric that is not measured.

## Cinematic expansion — September 2026

The continuous field occupies an authored valley. Scenery carries atmosphere; live instruments carry
facts. The chamber serves Dojo, Shrine and Honours. Generated plates contain no text or metrics;
`public/assets/environments/PROVENANCE.md` owns their art bible, prompts and export details.

QUIET below 0.12 momentum stops environmental air. ACTIVE breathes; RISING requires trend above 0.05;
HIGH begins at 0.65. SIEGE is a ceremony override. Falling momentum quiets the scene without a penalty
treatment. Lacquer is dawn, washi inverted fibre, sumi ink, kuro monochrome stone and jigoku warm ash.
Semantic tokens and shared geometry remain authoritative across all five worlds.

Thresholds open vertically in 360ms, split for Dojo and reveal laterally for Chronicle. They are
pointer-transparent and do not delay navigation. STILL AIR removes the threshold and environmental
travel while preserving the composition. Dojo removes rail/tabs, retains an explicit exit and records
elapsed minutes as thirty floor marks; the timer continues beyond thirty minutes.

Standard ground composes the existing crest, kind, difficulty and progress. Rhythmic goals have an
enclosure, clock goals a narrow horizon, bosses stepped foundations. Shrine monuments vary in height
by difficulty; bosses become landmarks. Inspection opens the factual record. Plant reserves its ID
once so the preview crest survives planting.

Campaign terrain fades radially into the valley, avoiding a visible rectangular slab. Opening framing
fits the actual canvas aspect, including portrait tablets. Selection foregrounds the chosen formation;
the Roll remains the complete semantic peer. CampaignIntel plots actual versus expected progress with
axes and exact text rows. Chronicle TimeStrata gives each period 76px, scales height by merit and
keeps zero-merit time on the baseline; selectable date/value controls carry the same record.

The siege retains eight beats, chapter staging and environmental depth. Its final tableau stays until
dismissed or ENTER THE SHRINE. Escape closes; STILL AIR advances by NEXT, Space or Enter without a
timer. Sound remains optional and sparse. On phones the final shrine action stays fixed beside the
exit, with 100px of content clearance for a scrolling honour record. Responsive image sources, compact
titles and a vertical oath preview support the mobile scope recorded in PRODUCT.md.
