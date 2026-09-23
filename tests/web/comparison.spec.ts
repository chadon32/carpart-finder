import { expect } from '@playwright/test'
import { test, assertNoUnexpectedRuntimeErrors } from './helpers/fixture'
import { expectResults, goToResults } from './helpers/journey'

const searchRoute = /\/api\/search(?:\?|$)/

test('comparison keeps an unknown shipping total unavailable', async ({ page, app, fixtureServer }, testInfo) => {
  await page.route(searchRoute, async (route) => {
    const response = await route.fetch()
    const payload = await response.json()
    delete payload.results[0].shippingCost
    await route.fulfill({ response, json: payload })
  })

  await goToResults(page, app.baseUrl)
  await expectResults(page)
  const cards = page.locator('.listing-card')
  await cards.nth(1).getByRole('button', { name: 'Compare' }).click()
  await cards.nth(0).getByRole('button', { name: 'Compare' }).click()
  await page.getByRole('button', { name: 'Compare Now' }).click()

  const comparison = page.getByRole('dialog', { name: 'Compare listings' })
  // Columns follow selection order: the second result was selected first.
  await expect(comparison.getByRole('columnheader')).toContainText([
    'Attribute', 'Toyota Camry Ceramic Brake Pads', '2020 Toyota Camry Front Brake Pad Set',
  ])
  const shipping = comparison.getByRole('row').filter({ hasText: 'Shipping Cost' })
  await expect(shipping.getByRole('cell')).toHaveText(['Shipping Cost', '+$4.99', 'Shown at checkout'])
  const total = comparison.getByRole('row').filter({ hasText: 'Item + known shipping (before tax)' })
  await expect(total.getByRole('cell')).toHaveText(['Item + known shipping (before tax)', '$54.49', 'Total unavailable'])
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})
