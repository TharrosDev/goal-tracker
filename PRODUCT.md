# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A single owner-user (Magnus), tracking his own financial and personal goals. Primary situation is
**desktop, seated, reviewing** — he opens the page to check where he stands and log progress, not to
process a queue. Phone use is real but occasional (log an amount, close it).

A secondary, non-editing audience exists: the screen is **occasionally shown to another person** —
a partner or friend, as an accountability check. That viewer has no context and five seconds. They must
be able to read where he stands without anything being explained to them.

## Product Purpose

Answer one question on sight: *how close am I to the things I said I'd do?* The product holds a small set
of personal commitments — money to save, amounts to earn, things to buy, milestones to reach — and shows
the distance between now and each finish line. Success is that logging progress feels worth doing, and
that a glance is genuinely informative rather than a list that needs reading.

## Positioning

Not a budgeting app and not a to-do list. It tracks *finish lines*, not transactions or tasks. There is no
account, no sync, no server, and no institution connected — the data is typed in by hand and lives only in
this browser. That constraint is the position: total privacy and zero setup, at the cost of portability.

## Operating Context

- Opened irregularly — sometimes daily, sometimes after a gap of weeks. It must make sense cold.
- Progress is logged manually after the fact ("I moved $200 into savings on Friday").
- Deadlines are self-imposed, and being behind one is normal and expected, not an error state.
- **3–6 goals live at once.** This is a small set of important things, never a long queue.
- Data survives only as long as the browser's localStorage; manual JSON export is the backup path.

## Capabilities and Constraints

Two goal types:
- **Money goals** — a dollar target, a running current amount, contributions added incrementally.
  Derived display: percent complete, amount remaining, and the weekly rate needed to hit the deadline.
- **Milestone goals** — binary done/not-done. No amount.

Both types optionally carry a target date. Goals can be renamed and deleted. Completed goals sort to the
bottom. A goal is "done" when a money target is reached or a milestone is checked.

Technical constraints, all binding:
- **Single static `index.html`.** No build step, no framework, no dependencies, no network requests.
  Deployed to Vercel as a static file from `TharrosDev/goal-tracker`.
- **No backend, no auth, no analytics.** `localStorage` is the only persistence.
- Everything — markup, styles, script — ships in that one file.
- Self-hosted or system fonts only; no external font CDN, since the page must work offline.

## Brand Commitments

None inherited. The product has no name beyond "Goals", no logo, and no existing identity to preserve.
The current dark UI is **evidence of function, not a binding visual commitment** — it is the anti-reference
for this redesign.

## Evidence on Hand

Only the user's own goal data, entered by hand. There are no customers, testimonials, benchmarks, or
external data sources, and none may be invented. Sample goals used in development ("Road bike, $2,400";
"Emergency fund") are realistic placeholders, not claims.

## Product Principles

1. **The number is the interface.** Where you stand is the content; chrome exists to frame it.
2. **Cold-open legible.** Someone who has never seen the page — including the owner after a month away —
   understands each goal's state without instruction.
3. **Behind is not failure.** Falling short of a self-imposed deadline is normal. Never punish, alarm,
   or scold; report the distance plainly.
4. **Logging must be cheaper than skipping it.** Adding progress is a few seconds of work or the data
   goes stale and the product dies.
5. **The constraint is the product.** One file, no server, no account. Anything that requires
   infrastructure is out of scope by definition, not by budget.

## Accessibility & Inclusion

No diagnosed user need on record. Standing requirement: legible type (the owner has pushed back twice on
undersized text — err larger), visible keyboard focus, real tap targets on phone, and a respected
`prefers-reduced-motion`.
