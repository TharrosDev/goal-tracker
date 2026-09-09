/**
 * Regenerates src/design/fonts/marks-600.woff2 from the full Noto Serif JP.
 *
 * The product uses 27 kanji as graphic marks. Shipping a whole CJK face for
 * them is 1.38MB; this subset is under 7KB, works offline, and gives correct
 * glyphs — which hand-drawn SVG paths would not.
 *
 * Requires Python with fonttools + brotli. Run after changing MARKS in
 * src/design/marks.ts:
 *   node scripts/subset-marks.mjs
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'

// A DEV dependency: this is the only thing that reads it, it runs by hand, and
// nothing it produces is fetched at runtime — the marks ship as the local
// subset in src/design/fonts.
const SOURCE = 'node_modules/@fontsource/noto-serif-jp/files/noto-serif-jp-japanese-600-normal.woff2'
const OUTPUT = 'src/design/fonts/marks-600.woff2'

// Pull the glyphs straight out of the registry so the two cannot drift.
const registry = readFileSync('src/design/marks.ts', 'utf8')
const glyphs = [...new Set([...registry.matchAll(/mark: '([^']+)'/g)].map((m) => m[1]).join(''))].join('')
if (!glyphs.length) throw new Error('no marks found in src/design/marks.ts')

execFileSync(
  'python',
  [
    '-c',
    `from fontTools import subset; subset.main([${JSON.stringify(SOURCE)}, "--text=" + ${JSON.stringify(glyphs)}, "--flavor=woff2", "--output-file=" + ${JSON.stringify(OUTPUT)}, "--layout-features=", "--no-hinting", "--desubroutinize", "--drop-tables+=GSUB,GPOS,GDEF"])`,
  ],
  { stdio: 'inherit' },
)
console.log(`${OUTPUT}: ${statSync(OUTPUT).size} bytes for ${glyphs.length} glyphs`)
