import { expect, test, type Page } from '@playwright/test'
import { freshDevice, open, plant, readTable } from './helpers'
import type { Goal, Milestone, TimelineEvent } from '../src/domain/types'

/**
 * TAKING BACK A DISPATCH — the whole thing, not the number.
 *
 * One dispatch can move the figure, cross gates, take the standard, pay merit
 * for each of those and unlock honours off the back of them. Undo has to
 * reverse ALL of it, and every surface has to agree afterwards. This is the
 * spec that exists because it once reversed two of those eight things and
 * matched the rest by whether their timestamps were within two seconds.
 */
test.beforeEach(async ({ page }) => {
  await freshDevice(page)
})

/** A standard with one gate on the way to its target. */
async function withGate(page: Page) {
  await open(page)
  const id = await plant(page, { title: 'Road bike', kind: 'MONETARY', target: 1000 })

  await page.getByRole('button', { name: /GOVERN THIS STANDARD/ }).click()
  await page.getByLabel('New gate').fill('Frame')
  await page.getByLabel('Value at which this gate is passed').fill('500')
  await page.getByRole('button', { name: 'ADD', exact: true }).click()
  // The runway is where a gate lives; the chronicle also now says one was set,
  // so this has to be specific about which "Frame" it is waiting for.
  await expect(page.locator('.runway').getByText('Frame')).toBeVisible()
  return id
}

async function send(page: Page, amount: number) {
  await page.getByRole('button', { name: 'SEND A DISPATCH' }).click()
  const sheet = page.getByRole('form', { name: 'Log a dispatch' })
  await sheet.locator('.dispatch__amount').fill(String(amount))
  await sheet.getByRole('button', { name: 'SEND', exact: true }).click()
  await expect(sheet).toBeHidden()
}

test('a dispatch can be taken back, and the figure goes with it', async ({ page }) => {
  const id = await withGate(page)
  await send(page, 120)

  expect((await readTable<Goal>(page, 'goals')).find((g) => g.id === id)!.current).toBe(120)

  await page.getByRole('button', { name: /Take back the dispatch/ }).click()
  await expect(page.getByRole('button', { name: /Take back the dispatch/ })).toBeHidden()

  const goal = (await readTable<Goal>(page, 'goals')).find((g) => g.id === id)!
  expect(goal.current).toBe(0)
  expect(await readTable(page, 'entries')).toHaveLength(0)

  // And the event went with it: the chronicle must not describe a dispatch that
  // no longer exists.
  const events = await readTable<TimelineEvent>(page, 'events')
  expect(events.filter((e) => e.type === 'progress')).toHaveLength(0)
})

test('taking back the dispatch that crossed a gate takes the gate back down', async ({ page }) => {
  const id = await withGate(page)
  await send(page, 600)

  expect((await readTable<Milestone>(page, 'milestones'))[0]!.done).toBe(true)

  await page.getByRole('button', { name: /Take back the dispatch/ }).click()
  await expect(page.getByRole('button', { name: /Take back the dispatch/ })).toBeHidden()

  const gate = (await readTable<Milestone>(page, 'milestones'))[0]!
  expect(gate.done).toBe(false)
  expect(gate.doneAt).toBeNull()
  expect(gate.doneBy).toBeNull()

  const events = await readTable<TimelineEvent>(page, 'events')
  expect(events.filter((e) => e.type === 'milestone')).toHaveLength(0)

  // The standard's own ground agrees: its runway shows the gate unpassed.
  await page.goto(`/standard/${id}`)
  await expect(page.locator('.runway li.is-passed')).toHaveCount(0)
})

test('taking back the dispatch that took the standard puts it back in play', async ({ page }) => {
  const id = await withGate(page)
  await send(page, 1000)

  // A completion is a big ceremony; it holds the screen until it is dismissed.
  await page.keyboard.press('Escape')
  await expect(page.locator('.fall')).toBeHidden()

  expect((await readTable<Goal>(page, 'goals')).find((g) => g.id === id)!.done).toBe(true)

  // Navigated within the app, not reloaded: the offer to take a dispatch back
  // is held in memory and does not — deliberately — survive a page load.
  await page.getByRole('link', { name: 'THE SHRINE' }).click()
  await expect(page.getByRole('heading', { name: '1 TAKEN' })).toBeVisible()

  await page.getByRole('button', { name: /Take back the dispatch/ }).click()
  await expect(page.getByRole('button', { name: /Take back the dispatch/ })).toBeHidden()

  const goal = (await readTable<Goal>(page, 'goals')).find((g) => g.id === id)!
  expect(goal.done).toBe(false)
  expect(goal.completedAt).toBeNull()
  expect(goal.completedBy).toBeNull()
  expect(goal.current).toBe(0)

  // Every surface returns to the truth, without a reload to help it: the
  // shrine empties under the person standing on it, and the standard is back on
  // the war table.
  await expect(page.getByRole('heading', { name: /THE SHRINE\s+IS BARE/ })).toBeVisible()

  await page.getByRole('link', { name: 'THE WAR TABLE' }).click()
  // On no clock, so it stands in the reserve — which is a real place, not a
  // lesser one. What matters is that it is standing at all.
  await expect(page.locator('.field').getByText('Road bike')).toBeVisible()

  const events = await readTable<TimelineEvent>(page, 'events')
  expect(events.filter((e) => e.type === 'completed')).toHaveLength(0)
  expect(events.filter((e) => e.type === 'milestone')).toHaveLength(0)
  // Only the planting is left, and it is the only thing that ever paid merit.
  expect(events.filter((e) => e.xp > 0 && e.type !== 'created' && e.type !== 'achievement'))
    .toHaveLength(0)
})

test('the offer to take it back closes on its own, and can be dismissed', async ({ page }) => {
  await withGate(page)
  await send(page, 10)

  const bar = page.getByRole('button', { name: /Take back the dispatch/ })
  await expect(bar).toBeVisible()
  await page.getByRole('button', { name: 'Dismiss' }).click()
  await expect(bar).toBeHidden()

  // Dismissing is not undoing: the dispatch stands.
  expect(await readTable(page, 'entries')).toHaveLength(1)
})
