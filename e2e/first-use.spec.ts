import { expect, test } from '@playwright/test'
import { freshDevice, open, plant, readTable } from './helpers'
import type { Goal } from '../src/domain/types'

/**
 * FIRST USE — an empty field, and the first standard planted in it.
 *
 * The empty state is a real state with its own dignity, so it is asserted as
 * one rather than skipped past on the way to the interesting tests.
 */
test.beforeEach(async ({ page }) => {
  await freshDevice(page)
})

test('the empty field says so, and offers the one act that changes it', async ({ page }) => {
  await open(page)

  await expect(page.getByRole('heading', { name: /THE FIELD\s+IS EMPTY/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'PLANT THE FIRST STANDARD' })).toBeVisible()

  // Nothing is standing, so nothing is drawn on the field.
  await expect(page.locator('.standard')).toHaveCount(0)
})

test('planting the first standard puts it on the field and in the database', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'PLANT THE FIRST STANDARD' }).click()
  await expect(page).toHaveURL(/\/plant$/)

  const id = await plant(page, {
    title: 'Road bike',
    kind: 'MONETARY',
    target: 2400,
    deadline: '2027-06-01',
  })

  // Its own ground opens, carrying the title and the figure it starts at.
  await expect(page.getByRole('heading', { name: 'Road bike' })).toBeVisible()

  const goals = await readTable<Goal>(page, 'goals')
  expect(goals).toHaveLength(1)
  expect(goals[0]).toMatchObject({
    id,
    title: 'Road bike',
    kind: 'money',
    target: 2400,
    current: 0,
    done: false,
  })

  // And it is standing on the war table, with an accessible sentence of its own.
  await page.goto('/')
  await expect(page.locator('.standard')).toHaveCount(1)
  await expect(page.getByRole('option', { name: /Road bike\. PLANTED\./ })).toBeVisible()
})

test('a created event is written alongside the goal', async ({ page }) => {
  await open(page)
  await plant(page, { title: 'Ship the thing', kind: 'MILESTONE' })

  const events = await readTable<{ type: string; goalId: string | null }>(page, 'events')
  expect(events.filter((e) => e.type === 'created')).toHaveLength(1)
})
