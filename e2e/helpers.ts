import { expect, type Page } from '@playwright/test'

/**
 * Shared moves for the end-to-end suite.
 *
 * Everything here drives the product the way a person does — visible text and
 * accessible roles, never a CSS class — with two exceptions that are about the
 * harness rather than the product: clearing the database before a run, and
 * reading it back to assert on what was actually persisted.
 */

/** The app's own database name (see src/data/db.ts). */
const DB = 'ambition-engine'

/**
 * A clean device.
 *
 * Playwright gives every test its own browser context, and IndexedDB and
 * localStorage are per-context — so the device is already fresh and there is
 * nothing to clear. This exists to say so at the top of every spec, and as the
 * one place to change if that ever stops being true.
 *
 * It must NOT be an init script that wipes storage: those run on every
 * navigation, so the second `page.goto` in a test would delete the world the
 * first half of the test had just built.
 */
export async function freshDevice(_page: Page): Promise<void> {
  // Intentionally empty. See above.
}

/** Seed the v1 almanac blob so the migration path can be driven end to end. */
export async function seedLegacy(page: Page, rows: unknown[]): Promise<void> {
  await page.addInitScript((payload) => {
    localStorage.setItem('goals.v1', payload as string)
  }, JSON.stringify(rows))
}

export async function open(page: Page, path = '/'): Promise<void> {
  await page.goto(path)
  // The shell renders an aria-busy placeholder until the database is open.
  await expect(page.locator('.camp, .boot-error')).toBeVisible()
}

/** Read a table straight out of IndexedDB, to assert on what was persisted. */
export async function readTable<T>(page: Page, table: string): Promise<T[]> {
  return page.evaluate(
    ([name, store]) =>
      new Promise<T[]>((resolve, reject) => {
        const request = indexedDB.open(name as string)
        request.onerror = () => reject(new Error('could not open the database'))
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction(store as string, 'readonly')
          const all = tx.objectStore(store as string).getAll()
          all.onsuccess = () => resolve(all.result as T[])
          all.onerror = () => reject(new Error('could not read ' + store))
        }
      }),
    [DB, table] as const,
  )
}

export interface PlantOptions {
  title: string
  kind?: string
  target?: number
  unit?: string
  deadline?: string
}

/**
 * Plant a standard through the quick form and land on its own ground.
 * Returns the new goal's id, taken from the URL it navigates to.
 */
export async function plant(page: Page, options: PlantOptions): Promise<string> {
  await page.goto('/plant')
  await page.getByPlaceholder('Name it').fill(options.title)

  // The radio itself is screen-reader-only; the label is what anybody actually
  // presses, so that is what this presses.
  if (options.kind)
    await page
      .getByRole('group', { name: 'KIND' })
      .getByText(options.kind, { exact: true })
      .click()
  if (options.target !== undefined)
    await page.locator('.plant__target').fill(String(options.target))
  if (options.unit) await page.locator('.plant__unit').fill(options.unit)
  if (options.deadline) await page.locator('.plant__date').fill(options.deadline)

  await page.getByRole('button', { name: 'PLANT IT' }).click()
  await page.waitForURL(/\/standard\/[^/]+$/)
  return page.url().split('/standard/')[1]!
}

/** Send a dispatch from a standard's own ground. */
export async function dispatch(page: Page, amount: number): Promise<void> {
  await page.getByRole('button', { name: 'SEND A DISPATCH' }).click()
  const panel = page.getByRole('form', { name: 'Log a dispatch' })
  await expect(panel).toBeVisible()
  await panel.locator('.dispatch__amount').fill(String(amount))
  await panel.getByRole('button', { name: 'SEND' }).click()
  await expect(panel).toBeHidden()
}

/** Wait out whichever ceremony a dispatch earned, without asserting its tier. */
export async function settleCeremony(page: Page): Promise<void> {
  const big = page.locator('.fall')
  if (await big.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape')
    await expect(big).toBeHidden()
  }
  await expect(page.locator('.sealing')).toBeHidden({ timeout: 10_000 })
}
