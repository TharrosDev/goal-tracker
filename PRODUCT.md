# PRODUCT

## What it is

A personal operating system for ambition. It holds the things one person said they would do, shows
the distance between now and each finish line, and makes the record of getting there worth keeping.

It is not a to-do list and not a budgeting app. It tracks **finish lines**, not tasks or
transactions. There is no account, no sync, no server and no institution connected: the data is
typed in by hand and lives in one browser on one device.

## Who it is for

One owner-user, tracking his own commitments. Primary situation is **desktop, seated, reviewing** —
opened to see where things stand and to log what happened, not to process a queue.

Mobile is explicitly **not** a target. The owner has said he will not use it on a phone. The
responsive CSS that exists is a courtesy, not a supported environment, and no further mobile work
should be done unless he asks.

A secondary, non-editing audience exists: the screen is occasionally shown to another person. That
viewer has no context and five seconds, and must be able to read where things stand without
anything being explained to them.

## What it answers, in order

1. **How much wind is behind me?** — momentum, as one figure and one force that moves everything.
2. **Where does every standard stand against its own line?** — the field.
3. **What is the next hour?** — the order of the day.

Everything else is downstream of those three.

## Operating context

- Opened irregularly. Sometimes daily, sometimes after weeks. **It must make sense cold.**
- Progress is logged by hand, after the fact.
- Deadlines are self-imposed, and being behind one is normal.
- **3–10 standards live at once.** A small set of important things, never a long queue.
- Data survives as long as the browser's IndexedDB. Manual export is the backup path.

## Capabilities

**Ten goal kinds** — money, numeric, percentage, habit, streak, project, deadline, milestone,
countdown, custom. Each carries an optional hour (deadline), house (category), gates (milestones),
ties to other standards, difficulty, priority, notes, recurrence and a boss flag.

**An append-only chronicle.** Every mutation writes a timeline event. Momentum, rank, merit,
streaks, honours, the survey and the time machine are all *folds over that log* — nothing derived is
stored twice, and the whole history is re-derivable after an import.

**Nine surfaces** — the war table, the campaign, a standard's own ground, the dojo, the shrine, the
chronicle, honours, the survey, the quartermaster.

**Five camps.** Whole authored visual worlds sharing one set of semantic tokens.

## Product principles

1. **The number is the interface.** Where you stand is the content; chrome exists to frame it.
2. **Cold-open legible.** Someone who has never seen it — including the owner after a month away —
   understands each standard's state without instruction.
3. **Behind is not failure.** Falling short of a self-imposed hour is normal. The product reports a
   distance and never scolds. There is no red X, no downward arrow, no streak-loss notice, and no
   copy anywhere for having fallen short. A quiet month is the quietest the interface ever gets, not
   the loudest.
4. **Logging must be cheaper than skipping it.** A dispatch is one field, already focused, and
   closes on submit. No ceremony is permitted to slow it down.
5. **Nothing invented.** Every figure on screen traces to a real value. Where there is not enough
   history to compute something honestly, the surface says so instead of drawing a chart around a
   guess.

## Constraints, all binding

- **Local-first.** IndexedDB is the only persistence. No backend, no auth, no analytics, no network
  request at runtime — fonts are self-hosted and the kanji face is subset into the bundle.
- **Data belongs to the user.** Export is a first-class action, not a settings-page afterthought.
- **The v1 almanac's data is sacred.** `goals.v1` is detected, migrated and *copied* — never moved,
  never cleared. See `DATA-MODEL.md`.
- **Accessibility is not traded for effect.** Every value clears 3:1, every piece of text 4.5:1, in
  all five camps, enforced by a test that fails the build.

## Inherited from v1

The nautical almanac that preceded this is gone, but its arithmetic is not. `perWeek`, `paceGap`,
the `BEHIND = 0.10` threshold, the fortnight urgency window and the figure formatting were ported
verbatim, and the original `demo()` assertions are now real tests in `src/domain/pace.test.ts`. Those
numbers had been on screen for months; a redesign was not allowed to move them.

The typography floors came with it too: labels never below 11.5px, body never below 19px. Undersized
text has been pushed back on twice. Err larger.
