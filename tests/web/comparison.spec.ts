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
  // Pick cards by title: results sort by known total, so the listing with
  // unknown shipping moves last and positions no longer identify listings.
  const card = (title: string) => page.locator('.listing-card').filter({ hasText: title })
  await card('Toyota Camry Ceramic Brake Pads').getByRole('button', { name: 'Compare' }).click()
  await card('2020 Toyota Camry Front Brake Pad Set').getByRole('button', { name: 'Compare' }).click()
  await page.getByRole('button', { name: 'Compare Now' }).click()

  const comparison = page.getByRole('dialog', { name: 'Compare listings' })
  // Columns follow selection order, not result order.
  await expect(comparison.getByRole('columnheader')).toContainText([
    'Attribute', 'Toyota Camry Ceramic Brake Pads', '2020 Toyota Camry Front Brake Pad Set',
  ])
  const shipping = comparison.getByRole('row').filter({ hasText: 'Shipping Cost' })
  await expect(shipping.getByRole('cell')).toHaveText(['Shipping Cost', '+$4.99', 'Shown at checkout'])
  const total = comparison.getByRole('row').filter({ hasText: 'Item + known shipping (before tax)' })
  await expect(total.getByRole('cell')).toHaveText(['Item + known shipping (before tax)', '$54.49', 'Total unavailable'])
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})
