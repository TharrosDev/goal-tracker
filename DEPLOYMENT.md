# DEPLOYMENT

## Local

```bash
pnpm install
pnpm dev            # vite, http://localhost:5173
pnpm check          # lint + typecheck + tests + production build
```

Individually: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

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
| `index.js` | ~391 kB | ~120 kB | always |
| `index.css` | ~55 kB | ~12 kB | always |
| `webgl.js` | ~1.09 MB | ~300 kB | **only when the camp is opened** |
| fonts | ~230 kB | — | per subset, as glyphs are used |

The WebGL chunk is split in `vite.config.ts` and lazily imported by `src/routes/Campaign.tsx`. It
must never end up on the critical path — logging a dispatch cannot wait on three.js. If you touch
the campaign, re-check the build output.

Fonts are self-hosted from npm (Archivo Variable, JetBrains Mono Variable) plus a 6.8 kB subset of
Noto Serif JP holding exactly the 27 kanji the product uses. Regenerate that subset with
`node scripts/subset-marks.mjs` after changing `src/design/marks.ts`; it needs Python with
`fonttools` and `brotli`.

## Verifying a deploy

1. Open the deployed URL. The war table renders and the network log shows **no** `webgl` chunk.
2. Open the campaign. The chunk loads once; the camp renders.
3. Quartermaster → Export. A JSON file downloads.
4. Hard-reload. Data survives (IndexedDB, per browser, per device).

## What could break it

- **Changing the framework preset back to static.** The build output is `dist/`, not the repo root.
- **Removing the SPA rewrite.** Every route but `/` 404s on a direct hit.
- **A new dependency that pulls three.js into the main graph.** Check `pnpm build` output.
- **Clearing site data.** There is no server copy. This is the product's central trade, and it is why
  export is the first thing on the quartermaster.
