import { expect } from '@playwright/test'
import { test, assertNoUnexpectedRuntimeErrors } from './helpers/fixture'
import { expectDesktopAppInert, expectResults, goToResults, openDetails, openWatchlist } from './helpers/journey'

test('a dialog preserves its opener across the phone and desktop breakpoint', async ({ page, app, fixtureServer }, testInfo) => {
  await page.setViewportSize({ width: 1100, height: 844 })
  await goToResults(page, app.baseUrl)
  for (const card of await page.locator('.listing-card').all()) {
    await card.getByRole('button', { name: 'Compare', exact: true }).click()
  }
  const opener = page.getByRole('button', { name: 'Compare Now' })
  await opener.focus()
  await opener.press('Enter')
  for (const width of [390, 1100]) {
    await page.setViewportSize({ width, height: 844 })
    await expect(page.getByRole('dialog', { name: 'Compare listings' })).toBeVisible()
    await expect(page.locator('[data-vaul-drawer][role="dialog"]')).toHaveCount(width < 640 ? 1 : 0)
    await expect(page.locator('#root')).toHaveJSProperty('inert', true)
  }
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.locator('#root')).toHaveJSProperty('inert', false)
  await expect(opener).toBeFocused()
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('watchlist and result dialogs remain local and keyboard accessible', async ({ page, app, fixtureServer }, testInfo) => {
  await goToResults(page, app.baseUrl)
  const cards = page.locator('.listing-card')

  const watchButton = cards.nth(0).getByRole('button', { name: /Watch/ })
  // Firefox's automatic nearest-edge scroll can place the target at y=22,
  // under the transitioning sticky header. Scroll into reading space first;
  // retain a real pointer click and all actionability checks.
  await watchButton.evaluate((button) => button.scrollIntoView({ block: 'center', behavior: 'instant' }))
  await watchButton.click()
  await expect(cards.nth(0).getByRole('button', { name: /Watching/ })).toBeDisabled()
  await openWatchlist(page)
  await expect(page.getByText('2020 Toyota Camry Front Brake Pad Set')).toBeVisible()
  await page.getByRole('button', { name: 'Remove from Watchlist' }).click()
  await expect(page.getByRole('heading', { name: 'Your Watchlist is empty' })).toBeVisible()

  await page.getByRole('button', { name: 'Start Searching Parts' }).click()
  await expectResults(page)
  if (await page.evaluate(() => window.innerWidth < 640)) {
    await page.getByRole('button', { name: 'Filters' }).click()
    const filters = page.getByRole('dialog', { name: 'Filter listings' })
    await expect(filters).toBeVisible()
    await expect(filters).toContainText('Delivery ZIP code')
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement))).toBe(true)
    await page.getByRole('button', { name: 'Show results' }).click()
    await expect(filters).toBeHidden()
  } else {
    const condition = page.getByRole('group', { name: 'Condition' })
    await condition.getByRole('button', { name: 'new', exact: true }).click()
    await expect(condition.getByRole('button', { name: 'new', exact: true })).toHaveAttribute('aria-pressed', 'true')
  }

  await openDetails(page)
  const details = page.getByRole('dialog', { name: /listing details/ })
  await expectDesktopAppInert(page, true)
  await details.getByLabel('Close').click()
  await expect(details).toBeHidden()
  await expectDesktopAppInert(page, false)

  await cards.nth(1).getByRole('button', { name: 'Compare' }).click()
  await cards.nth(0).getByRole('button', { name: 'Compare' }).click()
  await page.getByRole('button', { name: 'Compare Now' }).click()
  const comparison = page.getByRole('dialog', { name: 'Compare listings' })
  await expect(comparison).toBeVisible()
  await expectDesktopAppInert(page, true)
  await expect(comparison.getByRole('table')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(comparison).toBeHidden()
  await expectDesktopAppInert(page, false)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})
