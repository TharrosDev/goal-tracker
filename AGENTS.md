# THE AMBITION ENGINE

Read PRODUCT.md, DESIGN.md, ARCHITECTURE.md and DATA-MODEL.md before changes.
Verify Git root, remote, branch and uncommitted work. Preserve unrelated edits.

## Authorities

- React/TypeScript/Vite; domain rules import no platform code.
- `src/data/repo.ts` is the only mutation boundary. Write records and causal events in one transaction.
- `src/state/selectors.ts` owns goal/world projections. Never invent a second progress calculation.
- Preserve migrations, causal undo, imports, snapshots, local privacy, and the accessible Campaign Roll.
- `NewGoal.id` can reserve a ritual identity. Creation uses `add`, never `put`: duplicate IDs must fail without overwriting anything.

## Cinematic work

- `src/cinema/` owns scenery, intensity, scene thresholds and goal presence.
- Scenery is decorative. Figures, scales, titles and actions must remain legible without any image.
- Time is left-to-right, progress is height, the line is expected pace; goals are standards.
- No shaming. A quiet campaign becomes quiet. Deadline pressure belongs to the affected goal.
- Five worlds use tokens/material configuration, never five copies of a route.
- STILL AIR keeps all content and user-paced ceremony tableaux. Test the actual rendered result.
- Mobile is supported by the September 2026 brief: inspect 390×844, 430×932, tablet and desktop.
- Never transform an ancestor of the WebGL canvas. Keep its resolved box and zero resize debounce.
- Keep Three.js behind Campaign's lazy boundary. Memoize GPU resources and dispose allocations.
- Stop ambient work when hidden or reduced-motion; do not add per-standard animation loops.
- Generated plates live in `public/assets/environments/`. See PROVENANCE.md there. Version new filenames; optimize desktop and phone derivatives. Never bake text or data into artwork.
- Don't publish or push unless asked. A push to main deploys.

## Verification

`pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm e2e`.
`pnpm check:all` runs the full suite. Browser tests use production preview and isolated IndexedDB.
Tests do not establish visual quality: inspect real desktop/mobile screenshots, including populated Shrine and boss completion. Use isolated demonstration data, never the user's browser record.
Confirm `dist/index.html` has no CampaignScene module preload after changing chunk boundaries.
