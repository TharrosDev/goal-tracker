import { expect, test } from '@playwright/test'
import { freshDevice, open, plant } from './helpers'
import type { Goal } from '../src/domain/types'
import { readTable } from './helpers'

/**
 * THE CAMPAIGN — reorganising the camp from the map.
 *
 * Driven through THE ROLL, which is a peer of the WebGL scene and not a
 * fallback from it: every fact and every act is reachable in both, and the roll
 * is the one that does not need a GPU in a CI container. The scene gets one
 * smoke test of its own, skipped where WebGL is unavailable.
 */
test.beforeEach(async ({ page }) => {
  await freshDevice(page)
})

async function twoStandards(page: import('@playwright/test').Page) {
  await open(page)
  const a = await plant(page, { title: 'Road bike', kind: 'MONETARY', target: 2400 })
  const b = await plant(page, { title: 'Wheels fund', kind: 'MONETARY', target: 400 })
  await page.goto('/campaign')
  await page.getByRole('button', { name: 'THE ROLL' }).click()
  return { a, b }
}

test('a standard can be chosen and opened from the roll', async ({ page }) => {
  await twoStandards(page)

  const row = page.getByRole('button', { name: /Road bike/ }).first()
  await row.click()
  await expect(row).toHaveAttribute('aria-pressed', 'true')

  // The chosen standard's own actions appear beside the map.
  await expect(page.getByRole('button', { name: 'GO TO IT →' })).toBeVisible()

  // Opening is keyboard-reachable, not double-click only.
  await page.getByRole('button', { name: 'Go to Road bike' }).click()
  await expect(page).toHaveURL(/\/standard\//)
})

test('two standards can be tied together, and the tie cut again', async ({ page }) => {
  const { a, b } = await twoStandards(page)

  await page.getByRole('button', { name: /Road bike/ }).first().click()
  await page.getByRole('button', { name: 'TIE TO…' }).click()
  await expect(page.getByText('CHOOSE THE OTHER STANDARD')).toBeVisible()
  await page.getByRole('button', { name: /Wheels fund/ }).first().click()

  await expect(page.getByText(/STANDS WITH/).first()).toBeVisible()
  const tied = await readTable<Goal>(page, 'goals')
  expect(tied.find((g) => g.id === a)!.linkedIds).toContain(b)
  // A tie has two ends. It used to be possible to write only one.
  expect(tied.find((g) => g.id === b)!.linkedIds).toContain(a)

  // And cutting it removes both ends.
  await page.getByRole('button', { name: /Road bike/ }).first().click()
  await page.getByRole('button', { name: 'TIE TO…' }).click()
  await page.getByRole('button', { name: /Wheels fund/ }).first().click()

  await expect(page.getByText(/STANDS WITH/)).toHaveCount(0)
  const cut = await readTable<Goal>(page, 'goals')
  expect(cut.find((g) => g.id === a)!.linkedIds).toHaveLength(0)
  expect(cut.find((g) => g.id === b)!.linkedIds).toHaveLength(0)
})

test('one standard can be made to belong to another, and freed again', async ({ page }) => {
  const { a, b } = await twoStandards(page)

  await page.getByRole('button', { name: /Wheels fund/ }).first().click()
  await page.getByRole('button', { name: 'BELONGS TO…' }).click()
  await page.getByRole('button', { name: /Road bike/ }).first().click()

  // The roll indents a detachment under what it belongs to: the tie IS the
  // layout, so waiting for that is waiting for the write to have landed.
  await expect(page.locator('.roll__detachments')).toBeVisible()
  expect((await readTable<Goal>(page, 'goals')).find((g) => g.id === b)!.parentId).toBe(a)

  await page.getByRole('button', { name: /Wheels fund/ }).first().click()
  await page.getByRole('button', { name: 'FREE IT' }).click()
  // FREE IT is offered only to something that belongs to something. Its going
  // away is the interface saying the write is done.
  await expect(page.getByRole('button', { name: 'FREE IT' })).toBeHidden()
  expect((await readTable<Goal>(page, 'goals')).find((g) => g.id === b)!.parentId).toBeNull()
})

test('a standard cannot be made to belong to itself, at any remove', async ({ page }) => {
  const { a, b } = await twoStandards(page)

  await page.getByRole('button', { name: /Wheels fund/ }).first().click()
  await page.getByRole('button', { name: 'BELONGS TO…' }).click()
  await page.getByRole('button', { name: /Road bike/ }).first().click()
  await expect(page.locator('.roll__detachments')).toBeVisible()

  // Now try to close the loop the other way round.
  await page.getByRole('button', { name: /Road bike/ }).first().click()
  await page.getByRole('button', { name: 'BELONGS TO…' }).click()
  await page.getByRole('button', { name: /Wheels fund/ }).first().click()
  await expect(page.getByText('CHOOSE THE OTHER STANDARD')).toBeHidden()

  const goals = await readTable<Goal>(page, 'goals')
  expect(goals.find((g) => g.id === a)!.parentId).toBeNull()
  expect(goals.find((g) => g.id === b)!.parentId).toBe(a)
})

test('the camp draws, and says nothing to the console while it does', async ({ page }) => {
  const complaints: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') complaints.push(m.text())
  })
  page.on('pageerror', (e) => complaints.push(e.message))

  await open(page)
  await plant(page, { title: 'Road bike', kind: 'MONETARY', target: 2400 })
  await page.goto('/campaign')

  // The scene is lazy, so the canvas is not there on the first frame. Wait for
  // whichever reading this machine actually gets before deciding anything.
  const canvas = page.locator('canvas')
  await expect(canvas.or(page.locator('.roll')).first()).toBeVisible()
  if (!(await canvas.count())) test.skip(true, 'this browser was given the roll, not the camp')

  await expect(canvas).toBeVisible()
  // A canvas with no drawing buffer measures zero: the r3f measurement trap.
  const box = await canvas.boundingBox()
  expect(box!.width).toBeGreaterThan(100)
  expect(box!.height).toBeGreaterThan(100)

  // The name of the standard floats above it, in HTML rather than a texture.
  await expect(page.locator('.camp3d__label', { hasText: 'Road bike' })).toBeVisible()
  expect(complaints).toEqual([])
})
