import { expect, test, type Page } from '@playwright/test'
import { freshDevice, open, plant } from './helpers'
import { addDays, today } from '../src/domain/date'

/**
 * THE WAR TABLE — the field, and the keyboard that walks it.
 *
 * The field is one listbox over one space. Everything here is about that being
 * true: that the thing the arrows move to is the thing Enter opens, that the
 * option a screen reader is pointed at actually exists, and that a phone gets a
 * field rather than a pile of standards clamped against the left edge.
 */
test.beforeEach(async ({ page }) => {
  await freshDevice(page)
})

async function aFewStandards(page: Page) {
  await open(page)
  await plant(page, {
    title: 'Road bike',
    kind: 'MONETARY',
    target: 2400,
    deadline: addDays(today(), 90),
  })
  await plant(page, {
    title: 'Ten thousand words',
    kind: 'NUMERIC',
    target: 10_000,
    deadline: addDays(today(), 40),
  })
  // No hour: this one stands in the reserve, which is a real place.
  await plant(page, { title: 'Learn to swim', kind: 'MILESTONE' })
  await open(page, '/')
  await expect(page.getByRole('listbox')).toBeVisible()
}

test('the field can be entered from the keyboard before anything is chosen', async ({ page }) => {
  await aFewStandards(page)

  const field = page.getByRole('listbox')
  await field.focus()
  await expect(field).toBeFocused()

  // Nothing is chosen yet, and the first arrow chooses the first standard.
  await expect(field).not.toHaveAttribute('aria-activedescendant', /./)
  await page.keyboard.press('ArrowRight')
  await expect(field).toHaveAttribute('aria-activedescendant', /^standard-/)
})

test('what the arrows point at is an element that actually exists', async ({ page }) => {
  await aFewStandards(page)
  const field = page.getByRole('listbox')
  await field.focus()

  // Walk the whole field, including into the reserve, and check every step.
  for (let i = 0; i < 5; i += 1) {
    await page.keyboard.press('ArrowRight')
    const id = await field.getAttribute('aria-activedescendant')
    expect(id).toBeTruthy()
    await expect(page.locator(`#${id}`)).toHaveCount(1)
    await expect(page.locator(`#${id}`)).toHaveAttribute('aria-selected', 'true')
  }
})

test('Enter opens the standard the arrows landed on, including in the reserve', async ({
  page,
}) => {
  await aFewStandards(page)
  const field = page.getByRole('listbox')
  await field.focus()

  // End walks to the last thing on the field, which is the reserve.
  await page.keyboard.press('End')
  const id = await field.getAttribute('aria-activedescendant')
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(/\/standard\//)
  // The standard it opened is the one it said was selected.
  expect(page.url()).toContain(id!.replace('standard-', ''))
})

test('every standard is one option, and only one', async ({ page }) => {
  await aFewStandards(page)
  await expect(page.getByRole('option')).toHaveCount(3)
})

test.describe('at phone width', () => {
  test.use({ viewport: { width: 390, height: 740 } })

  test('the field is a field, not a pile', async ({ page }) => {
    await aFewStandards(page)

    // The names come out from under the standards and go into the roll below,
    // so the poles can stand apart instead of being clamped on top of each
    // other against the left edge.
    await expect(page.locator('.field--compact')).toBeVisible()
    await expect(page.locator('.field__roll')).toBeVisible()

    const lefts = await page.locator('.standard').evaluateAll((nodes) =>
      nodes.map((n) => n.getBoundingClientRect().left),
    )
    expect(lefts.length).toBe(2)
    // Distinct positions: the whole point of the field is that where a standard
    // stands is how far through its own span it is.
    expect(new Set(lefts.map((l) => Math.round(l))).size).toBe(lefts.length)

    // Still one option per standard, and the names are readable.
    await expect(page.getByRole('option')).toHaveCount(3)
    await expect(page.locator('.field__roll').getByText('Road bike')).toBeVisible()
    await expect(page.locator('.field__roll').getByText('Learn to swim')).toBeVisible()
  })

  test('nothing on the war table scrolls sideways', async ({ page }) => {
    await aFewStandards(page)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
