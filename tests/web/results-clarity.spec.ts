import { expect, type Page } from '@playwright/test'
import { test, assertNoUnexpectedRuntimeErrors } from './helpers/fixture'
import { fixtureRoute, goToResults } from './helpers/journey'

const searchRoute = /\/api\/search(?:\?|$)/

// The fixture's two listings, re-shaped by each test.
async function reshapeSearch(page: Page, reshape: (body: any, template: any) => void) {
  await page.route(searchRoute, async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    reshape(body, body.results[0])
    await route.fulfill({ response, json: body })
  })
}

const listing = (template: any, fields: Record<string, unknown>) => ({ ...template, ...fields })

test('matched listings say what matched in plain words and show the total only when it adds information', async ({ page, app, fixtureServer }, testInfo) => {
  await goToResults(page, app.baseUrl)
  const cards = page.locator('.listing-card')
  await expect(cards.first()).toContainText('Year, make & model match')
  await expect(page.getByRole('heading', { name: 'Matches for your 2020 Toyota Camry LE' })).toBeVisible()
  await expect(page.getByText(/YMM/)).toHaveCount(0)
  // Free shipping: the price is the total, so no second line. Paid shipping: show the total.
  await expect(cards.first()).not.toContainText('with shipping')
  await expect(cards.nth(1)).toContainText('$54.49 with shipping')
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('unknown shipping says so plainly instead of implying a total', async ({ page, app, fixtureServer }, testInfo) => {
  await reshapeSearch(page, (body, template) => {
    body.results = [listing(template, { id: 'unknown', title: 'Shipping unknown item', price: 30, shippingCost: null })]
    body.fitmentSummary = { ...body.fitmentSummary, verified: 1 }
  })
  await page.goto(`${app.baseUrl}/${fixtureRoute}`, { waitUntil: 'domcontentloaded' })
  const card = page.locator('.listing-card').first()
  await expect(card).toContainText('Shipping shown at checkout')
  await expect(card).not.toContainText('total unavailable')
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('when nothing is confirmed, one notice explains it and the list is labeled honestly', async ({ page, app, fixtureServer }, testInfo) => {
  await reshapeSearch(page, (body) => {
    body.fallbackResults = body.results.map((item: any) => ({ ...item, verifiedFitment: false, fitmentTier: 'fallback' }))
    body.results = []
    body.fitmentSummary = { verified: 0, fallback: body.fallbackResults.length, hiddenIrrelevantFallbacks: 1 }
  })
  await page.goto(`${app.baseUrl}/${fixtureRoute}`, { waitUntil: 'domcontentloaded' })
  const cards = page.locator('.listing-card')
  await expect(cards).toHaveCount(2)

  await expect(page.getByRole('heading', { name: 'None of these are confirmed for your 2020 Toyota Camry LE' })).toBeVisible()
  await expect(page.getByText('2 possible matches')).toBeVisible()
  await expect(page.getByText(/0 listings/i)).toHaveCount(0)
  await expect(cards.first()).toContainText('Fit not confirmed')
  // The badge carries the warning; the cards themselves are not ringed in amber.
  await expect(page.locator('.listing-card[class*="ring-amber"]')).toHaveCount(0)
  // No second heading repeating the same message.
  await expect(page.getByRole('heading', { name: /keyword results/i })).toHaveCount(0)
  await expect(page.getByText(/YMM/)).toHaveCount(0)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('unconfirmed results that sit under confirmed ones get a short, plain heading', async ({ page, app, fixtureServer }, testInfo) => {
  await reshapeSearch(page, (body, template) => {
    body.fallbackResults = [listing(template, { id: 'other', title: 'Other brake pads', seller: 'Other seller', verifiedFitment: false, fitmentTier: 'fallback' })]
    body.fitmentSummary = { ...body.fitmentSummary, fallback: 1 }
  })
  await page.goto(`${app.baseUrl}/${fixtureRoute}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.listing-card')).toHaveCount(3)
  await expect(page.getByRole('heading', { name: 'More results that do not list your vehicle' })).toBeVisible()
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('phone results are compact and sorting lives in the sort and filter sheet', async ({ page, app, fixtureServer }, testInfo) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 640, 'Phone layout only')
  await reshapeSearch(page, (body, template) => {
    body.results = [
      listing(template, { id: 'cheapest', title: 'Cheapest item, shipping unknown', price: 5, shippingCost: null }),
      listing(template, { id: 'middle', title: 'Middle item, paid shipping', price: 12, shippingCost: 15 }),
      listing(template, { id: 'priciest', title: 'Priciest item, free shipping', price: 20, shippingCost: 0 }),
    ]
    body.fitmentSummary = { ...body.fitmentSummary, verified: 3 }
  })
  await page.goto(`${app.baseUrl}/${fixtureRoute}`, { waitUntil: 'domcontentloaded' })
  const cards = page.locator('.listing-card')
  await expect(cards).toHaveCount(3)

  const height = (await cards.first().boundingBox())!.height
  expect(height, `phone card is ${Math.round(height)}px tall`).toBeLessThan(290)

  const sortAndFilters = page.getByRole('button', { name: 'Sort & filters' })
  const overflow = await sortAndFilters.evaluate((button) => button.parentElement!.scrollWidth - button.parentElement!.clientWidth)
  expect(overflow, 'the phone toolbar must not scroll sideways').toBeLessThanOrEqual(0)
  await expect(page.getByRole('combobox', { name: 'Sort listings' })).toHaveCount(0)

  await expect(cards.locator('h3')).toHaveText(['Priciest item, free shipping', 'Middle item, paid shipping', 'Cheapest item, shipping unknown'])
  await sortAndFilters.click()
  const sheet = page.getByRole('dialog', { name: 'Sort and filter listings' })
  await sheet.getByRole('radio', { name: 'Lowest item price' }).check()
  await sheet.getByRole('button', { name: 'Show results' }).click()
  await expect(cards.locator('h3')).toHaveText(['Cheapest item, shipping unknown', 'Middle item, paid shipping', 'Priciest item, free shipping'])
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('phone shoppers can reach other stores without scrolling past every unconfirmed listing', async ({ page, app, fixtureServer }, testInfo) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 640, 'Phone layout only')
  await reshapeSearch(page, (body) => {
    body.fallbackResults = body.results.map((item: any) => ({ ...item, verifiedFitment: false, fitmentTier: 'fallback' }))
    body.results = []
    body.fitmentSummary = { verified: 0, fallback: body.fallbackResults.length, hiddenIrrelevantFallbacks: 0 }
  })
  await page.goto(`${app.baseUrl}/${fixtureRoute}`, { waitUntil: 'domcontentloaded' })
  const stores = page.getByText('Check other stores')
  await expect(stores).toBeVisible()
  const storesTop = (await stores.boundingBox())!.y
  const firstCardTop = (await page.locator('.listing-card').first().boundingBox())!.y
  expect(storesTop).toBeLessThan(firstCardTop)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('the sidebar stays below the list until there is room for two columns', async ({ page, app, fixtureServer }, testInfo) => {
  await page.setViewportSize({ width: 900, height: 1000 })
  await goToResults(page, app.baseUrl)
  const list = page.locator('.listing-card').first()
  const aside = page.locator('aside').first()
  const below = async () => (await aside.boundingBox())!.y > (await list.boundingBox())!.y + 100
  expect(await below(), 'at 900px the sidebar is below the list').toBe(true)

  await page.setViewportSize({ width: 1200, height: 1000 })
  const listBox = (await list.boundingBox())!
  const asideBox = (await aside.boundingBox())!
  expect(asideBox.x, 'at 1200px the sidebar is beside the list').toBeGreaterThan(listBox.x + listBox.width - 1)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('compare is one toggle per listing and one action bar', async ({ page, app, fixtureServer }, testInfo) => {
  await goToResults(page, app.baseUrl)
  const cards = page.locator('.listing-card')
  const first = cards.nth(0).getByRole('button', { name: 'Compare', exact: true })
  await expect(first).toHaveAttribute('aria-pressed', 'false')
  await first.click()
  await expect(first).toHaveAttribute('aria-pressed', 'true')
  await cards.nth(1).getByRole('button', { name: 'Compare', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Compare now$/i })).toHaveCount(1)
  await expect(page.getByRole('button', { name: /^Compare \(\d\)$/ })).toHaveCount(0)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('each listing action is announced with the listing it belongs to', async ({ page, app, fixtureServer }, testInfo) => {
  await goToResults(page, app.baseUrl)
  const first = page.locator('.listing-card').first()
  const title = await first.getByRole('heading', { level: 3 }).innerText()
  await expect(first.getByRole('button', { name: 'Details', exact: true })).toHaveAccessibleDescription(title)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})
