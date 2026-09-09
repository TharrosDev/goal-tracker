# DEPLOYMENT

## Local

```bash
pnpm install
pnpm dev            # vite, http://localhost:5173
pnpm check          # lint + typecheck + tests + production build
pnpm e2e            # the Playwright journeys, against a production build
pnpm check:all      # both
```

Individually: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

`.github/workflows/ci.yml` runs all of it on every push and pull request to `main`. A red build is a
red pull request; nothing here relies on somebody remembering to run the checks locally.

## Vercel

The project was a single static `index.html` before the rebuild, so **the framework preset had to
change**. `vercel.json` pins it:

```json
{ "framework": "vite", "buildCommand": "pnpm build", "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

The rewrite matters: the app uses real routes (`/campaign`, `/standard/:id`, …) and a direct hit on
one of them 404s without it.

Pushing to `main` deploys. There is nothing to configure beyond the above — no environment
variables, no secrets, no database, no integrations. The app makes **no network requests at runtime**.

## Bundle

| Chunk | Size | Gzip | When it loads |
|---|---|---|---|
| `index.js` | ~598 kB | ~184 kB | always |
| `index.css` | ~58 kB | ~13 kB | always |
| `CampaignScene.js` | ~907 kB | ~242 kB | **only when the camp is opened** |
| fonts | latin only | — | as glyphs are used |

**There is no `manualChunks` block in `vite.config.ts`, and there must not be one.** It looked like
it was splitting three.js out; it was doing the opposite. Rolldown forms the manual group first and
then places the entry's shared vendor modules into that group's chunk, so react, react-dom, scheduler
and zustand ended up inside the 1.09 MB `webgl` chunk — which made it a **static** import of the
entry, correctly `modulepreload`ed from `index.html`. Everybody who opened the war table downloaded
the whole of three.js before first paint, and the `React.lazy()` boundary bought nothing. Deleting
the block moved 903 kB off the critical path: **421.7 kB gzip → 183.8 kB**.

Do not reach for `build.modulePreload.resolveDependencies` to hide the preload link either — that
removes the hint while leaving the static import, turning a parallel fetch into a serial one.

If you touch the campaign, re-check the build output: `dist/index.html` must contain **no**
`modulepreload` for the campaign chunk, and the entry must reference it only through a real
`import(...)`.

Fonts are self-hosted from npm (Archivo Variable, JetBrains Mono Variable) plus a 6.8 kB subset of
Noto Serif JP holding exactly the 27 kanji the product uses. Regenerate that subset with
`node scripts/subset-marks.mjs` after changing `src/design/marks.ts`; it needs Python with
`fonttools` and `brotli`.

## Offline and updates

The app installs, and once it has been opened once it works with no network at all. That is the whole
point: the record was never on a server, so losing the network should change nothing.

`public/sw.js` is deliberately small enough to read in one sitting. Two strategies:

- **The document** — network first, cache fallback, and every navigation resolves to the app shell,
  because this is a single-page app. A deploy is picked up on the next online load; a route typed
  directly while offline still opens.
- **Hashed build assets** (`/assets/*`, fonts, icons) — cache first. Their names contain a content
  hash, so a cached one cannot be stale.

**The user's data is never cached here.** IndexedDB is the one canonical store; nothing in the worker
reads it, writes it, or keeps a second copy.

The cache is named for the build id, which Vite stamps into the bundle and which the page puts on the
worker's registration URL (`/sw.js?v=…`). A service worker only updates when its own bytes change,
and `sw.js` is a static file that rarely does — the query string is what makes each deploy a
genuinely different worker, and what lets `activate` delete the previous build's cache.

A waiting version is **announced, never applied under somebody**: a person mid-dispatch who is
swapped onto a new build loses what they were typing. They take it when they say so, or on the next
cold start.

`vercel.json` sets the matching headers. JSON has no comments, so the reasons are here: `sw.js` must
revalidate on every request, because it is the thing that decides how long everything else lives and
a stale copy of it pins people to the build they first met; `/assets/*` is immutable for a year,
because those names contain a content hash and cannot go stale by definition.

## Verifying a deploy

1. Open the deployed URL. The war table renders and the network log shows **no** campaign chunk.
2. Open the campaign. The chunk loads once; the camp renders.
3. Quartermaster → Export. A JSON file downloads.
4. Hard-reload. Data survives (IndexedDB, per browser, per device).
5. Application → Service Workers: one worker, activated, its URL carrying this build's id.
6. Go offline and reload. The app opens, and every route typed directly still opens.
7. Install it. The icon, the name and the standalone window are the product's, not the browser's.

## What could break it

- **Changing the framework preset back to static.** The build output is `dist/`, not the repo root.
- **Removing the SPA rewrite.** Every route but `/` 404s on a direct hit.
- **A new dependency that pulls three.js into the main graph**, or re-adding `manualChunks`. Check
  `dist/index.html` for a `modulepreload` that should not be there.
- **Caching `sw.js`.** Everybody stays on the build they first met, forever.
- **Clearing site data.** There is no server copy. This is the product's central trade, and it is why
  export is the first thing on the quartermaster.
