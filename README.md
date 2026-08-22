# Goals

A single-page tracker for money goals (save $2,400 for a road bike) and milestone goals (sign the
contract). Add a target and an optional due date, then log progress as you go. Money goals show a figure
table, a surveyed scale bar, and the weekly rate needed to arrive on time.

Everything is stored in your browser's `localStorage` — no account, no server, no data leaves the device.
Each browser keeps its own list and clearing site data wipes it, so use **Export record** now and then.

## Design

Laid out as a nautical almanac: chart-blue ground, one continuous ruled sheet, tabular figures as the
content. Magenta is reserved strictly for cautions — a deadline within a fortnight, an overdue date, or a
goal materially behind pace — so an urgent entry is the only coloured mark on the page. See `DESIGN.md`.

## Running it

Open `index.html` in a browser. That is the whole build step; the font is embedded, so it works offline.

Run `demo()` in the devtools console to exercise the pace and formatting maths.
