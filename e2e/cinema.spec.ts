import { test, expect } from '@playwright/test'
import { open, seedLegacy, dispatch } from './helpers'

test.beforeEach(async ({ page }) => {
  await seedLegacy(page, [
    {
      id: 'cinema',
      type: 'money',
      title: 'THE EXPEDITION',
      target: 100,
      current: 30,
      deadline: '2026-12-01',
      createdAt: '2026-01-01',
    },
  ])
})

test('scene assets load, heavy campaign stays out of first load, and all routes remain reachable', async ({
  page,
}) => {
  const errors: string[] = []
  const requests: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('request', (r) => requests.push(r.url()))
  await open(page)
  await expect(page.locator('.scene-world img')).toHaveJSProperty('naturalWidth', 1536)
  expect(requests.some((url) => /CampaignScene-.*\.js/.test(url))).toBe(false)
  for (const route of [
    '/standard/cinema',
    '/dojo',
    '/shrine',
    '/chronicle',
    '/plant',
    '/honours',
    '/survey',
    '/quartermaster',
    '/campaign',
  ]) {
    await open(page, route)
    await expect(page.locator('.camp__main')).not.toBeEmpty()
  }
  expect(errors).toEqual([])
})

test('missing scenery preserves the field and fast entry', async ({ page }) => {
  await page.route('**/assets/environments/**', (route) => route.abort())
  await open(page)
  await expect(page.getByRole('listbox')).toBeVisible()
  await page.getByRole('button', { name: 'PLANT A STANDARD', exact: true }).click()
  await expect(page.getByPlaceholder('Name it')).toBeEditable()
})

test('a warmed route and its local artwork survive offline navigation', async ({
  page,
  context,
}) => {
  await open(page)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await open(page, '/dojo')
  await expect(page.locator('.scene-world img')).toHaveJSProperty('naturalWidth', 1536)
  await open(page, '/')
  await context.setOffline(true)
  await open(page, '/dojo')
  await expect(page.getByRole('button', { name: 'BEGIN', exact: true })).toBeVisible()
  await expect(page.locator('.scene-world img')).toHaveJSProperty('naturalWidth', 1536)
})

test('STILL AIR ceremony advances by button and remains skippable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page, '/standard/cinema')
  await dispatch(page, 70)
  const ceremony = page.getByRole('dialog', { name: 'THE EXPEDITION taken' })
  await expect(ceremony).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced')
  await ceremony.getByRole('button', { name: /NEXT.*1 OF 3/ }).click()
  await expect(ceremony.getByRole('button', { name: /NEXT.*2 OF 3/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(ceremony).toBeHidden()
})

for (const viewport of [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 834, height: 1112 },
]) {
  test(`cinematic routes retain their width at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    for (const route of ['/', '/standard/cinema', '/dojo', '/shrine', '/chronicle', '/plant']) {
      await open(page, route)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
    }
  })
}

test('tablet Campaign finishes loading with its standard framed inside the canvas', async ({
  page,
}) => {
  await page.setViewportSize({ width: 834, height: 1112 })
  await open(page, '/campaign')
  const label = page.locator('.camp3d__label').filter({ hasText: 'THE EXPEDITION' })
  await expect(label).toBeVisible({ timeout: 20000 })
  await expect
    .poll(async () => {
      const canvas = await page.locator('canvas').boundingBox()
      const name = await label.boundingBox()
      return (
        !!canvas &&
        !!name &&
        name.x >= canvas.x &&
        name.y >= canvas.y &&
        name.x + name.width <= canvas.x + canvas.width &&
        name.y + name.height <= canvas.y + canvas.height
      )
    })
    .toBe(true)
})
