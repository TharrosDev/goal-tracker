/**
 * Renders public/icon.svg to the PNG sizes the install prompt and iOS need.
 *
 * One-off: the PNGs are committed. Re-run it after editing the SVG.
 *   node scripts/render-icons.mjs
 *
 * Uses the Playwright chromium already installed for the end-to-end suite
 * rather than adding an image dependency for four files.
 */
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(root, 'public/icon.svg'), 'utf8')

const SIZES = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'favicon-32.png', size: 32 },
]

const browser = await chromium.launch()
const page = await browser.newPage()
for (const { file, size } of SIZES) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<style>html,body{margin:0;background:#0c1018}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  )
  writeFileSync(join(root, 'public', file), await page.screenshot({ omitBackground: false }))
  console.log(`${file}  ${size}x${size}`)
}
await browser.close()
