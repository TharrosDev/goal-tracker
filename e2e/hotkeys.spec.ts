import { expect, test } from '@playwright/test'
import { freshDevice, open, plant } from './helpers'

/**
 * THE KEYBOARD.
 *
 * Every command in this product is a single key, and every one of them is also
 * reachable by pointer — a shortcut is an accelerator, never the only way in.
 * Escape is the exception that proves it: it is the way out, so it works even
 * while typing.
 */
test.beforeEach(async ({ page }) => {
  await freshDevice(page)
  await open(page)
  await plant(page, { title: 'Road bike', kind: 'MONETARY', target: 2400 })
  await open(page, '/')
  // The rail is the shell, and the shell is what owns the keyboard. Pressing a
  // key before it has mounted presses it at nothing.
  await expect(page.getByRole('link', { name: 'THE CAMPAIGN' })).toBeVisible()
})

const SURFACES = [
  { key: 'h', url: /\/$/, name: 'THE WAR TABLE' },
  { key: 'g', url: /\/campaign$/, name: 'THE CAMPAIGN' },
  { key: 'f', url: /\/dojo$/, name: 'THE DOJO' },
  { key: 's', url: /\/shrine$/, name: 'THE SHRINE' },
  { key: 't', url: /\/chronicle$/, name: 'THE CHRONICLE' },
  { key: 'a', url: /\/honours$/, name: 'HONOURS' },
]

for (const surface of SURFACES) {
  test(`${surface.key} goes to ${surface.name}`, async ({ page }) => {
    await page.keyboard.press(surface.key)
    await expect(page).toHaveURL(surface.url)
  })
}

test('N plants a standard', async ({ page }) => {
  await page.keyboard.press('n')
  await expect(page).toHaveURL(/\/plant$/)
})

test('Q opens the dispatch sheet, and Escape closes it', async ({ page }) => {
  await page.keyboard.press('q')
  const sheet = page.getByRole('form', { name: 'Log a dispatch' })
  await expect(sheet).toBeVisible()

  // The amount field has the keyboard the moment the sheet opens.
  await expect(sheet.locator('.dispatch__amount')).toBeFocused()

  // Escape works from inside the field, which is where the hands already are.
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
})

test('/ and Ctrl+K both open the order book, and Escape closes it', async ({ page }) => {
  await page.keyboard.press('/')
  const book = page.getByRole('dialog', { name: 'Order book' })
  await expect(book).toBeVisible()
  await expect(page.getByLabel('Give an order')).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(book).toBeHidden()

  await page.keyboard.press('ControlOrMeta+k')
  await expect(book).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(book).toBeHidden()
})

test('the order book keeps the keyboard while it is open', async ({ page }) => {
  await page.keyboard.press('/')
  const book = page.getByRole('dialog', { name: 'Order book' })
  await expect(book).toBeVisible()

  // Tab walks the book's own controls and comes back round, rather than
  // wandering out into the surface behind it, which is still there.
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Tab')
    const inside = await book.evaluate((el) => el.contains(document.activeElement))
    expect(inside).toBe(true)
  }
})

test('closing an overlay gives the keyboard back to what opened it', async ({ page }) => {
  const opener = page.getByRole('link', { name: 'THE CAMPAIGN' })
  await opener.focus()
  await page.keyboard.press('/')
  await expect(page.getByRole('dialog', { name: 'Order book' })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(opener).toBeFocused()
})

test('a hotkey does not fire while somebody is typing', async ({ page }) => {
  await page.goto('/plant')
  const field = page.getByPlaceholder('Name it')
  await field.fill('New goal')
  // 'n' would otherwise navigate away and lose what was typed.
  await field.press('n')
  await expect(page).toHaveURL(/\/plant$/)
  await expect(field).toHaveValue('New goaln')
})
