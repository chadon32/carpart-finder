import { expect } from '@playwright/test'
import { test, assertNoUnexpectedRuntimeErrors } from './helpers/fixture'
import { fixtureRoute, openDetails } from './helpers/journey'
import { validateVisitBatch } from '../../shared/visitAnalytics.mjs'

test('public traffic, direct searches, and listing details emit only private-safe events', async ({
  page,
  app,
  fixtureServer,
}, testInfo) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'webdriver', { get: () => false }),
  )
  const batches: any[] = []
  await page.route('**/api/analytics/events', async (route) => {
    batches.push(route.request().postDataJSON())
    await route.fulfill({ status: 204 })
  })
  await page.goto(app.baseUrl, { waitUntil: 'domcontentloaded' })
  await expect
    .poll(
      () =>
        batches.flatMap((batch) => batch.events).filter((event) => event.name === 'Page Viewed')
          .length,
    )
    .toBe(1)
  const originalSession = batches[0].sessionId
  await page.goto(`${app.baseUrl}/${fixtureRoute}`, { waitUntil: 'domcontentloaded' })
  await openDetails(page)
  await expect
    .poll(() =>
      batches.flatMap((batch) => batch.events).some((event) => event.name === 'Listing Opened'),
    )
    .toBe(true)
  const events = batches.flatMap((batch) => batch.events)
  expect(events.filter((event) => event.name === 'Search Started')).toHaveLength(1)
  expect(events.some((event) => event.name === 'Vehicle Selected')).toBe(true)
  expect(events.some((event) => event.name === 'Search Results Viewed')).toBe(true)
  expect(events.filter((event) => event.name === 'Search Results Viewed')).toHaveLength(1)
  expect(batches.every((batch) => batch.sessionId === originalSession)).toBe(true)
  for (const batch of batches) expect(validateVisitBatch(batch)).not.toBeNull()
  expect(JSON.stringify(batches)).not.toMatch(/Camry|Toyota|Brake Pads|1HGCM|email|https?:/)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})
test('static guide page views share the tab visit with the public search app', async ({
  page,
  app,
  fixtureServer,
}, testInfo) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'webdriver', { get: () => false }),
  )
  const batches: any[] = []
  await page.route('**/api/analytics/events', async (route) => {
    batches.push(route.request().postDataJSON())
    await route.fulfill({ status: 204 })
  })
  await page.goto(`${app.baseUrl}/guides.html`, { waitUntil: 'domcontentloaded' })
  await expect.poll(() => batches.length).toBeGreaterThan(0)
  expect(batches[0].events[0].properties.page).toBe('guides')
  const id = batches[0].sessionId
  await page.goto(app.baseUrl, { waitUntil: 'domcontentloaded' })
  await expect.poll(() => batches.length).toBeGreaterThan(1)
  expect(batches[1].sessionId).toBe(id)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})
test('privacy opt-outs stop both app and editorial collection', async ({
  page,
  app,
  fixtureServer,
}, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
    Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true })
  })
  const requests: string[] = []
  await page.route('**/api/analytics/events', async (route) => {
    requests.push(route.request().url())
    await route.fulfill({ status: 204 })
  })
  await page.goto(`${app.baseUrl}/${fixtureRoute}`, { waitUntil: 'domcontentloaded' })
  await openDetails(page)
  await page.goto(`${app.baseUrl}/guides.html`, { waitUntil: 'domcontentloaded' })
  expect(requests).toEqual([])
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('store clicks are recorded as safe retailer IDs without navigating to a retailer', async ({
  page,
  app,
  fixtureServer,
}, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
    document.addEventListener(
      'click',
      (event) => {
        const link = (event.target as Element).closest('a[href]') as HTMLAnchorElement | null
        if (link && new URL(link.href).origin !== location.origin) event.preventDefault()
      },
      true,
    )
  })
  const batches: any[] = []
  await page.route('**/api/analytics/events', async (route) => {
    batches.push(route.request().postDataJSON())
    await route.fulfill({ status: 204 })
  })
  await page.route(/\/api\/search(?:\?|$)/, async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    body.results[0].link = 'https://www.ebay.com/itm/123456789012'
    body.results[0].source = 'eBay'
    await route.fulfill({ response, json: body })
  })
  await page.goto(`${app.baseUrl}/${fixtureRoute}`, { waitUntil: 'domcontentloaded' })
  await page.locator('.listing-card').first().getByRole('link', { name: 'View on eBay' }).click()
  await expect
    .poll(
      () =>
        batches
          .flatMap((batch) => batch.events)
          .filter((event) => event.name === 'Retailer Clicked').length,
    )
    .toBe(1)
  const event = batches
    .flatMap((batch) => batch.events)
    .find((event) => event.name === 'Retailer Clicked')
  expect(event.properties).toEqual({ retailerId: 'ebay' })
  expect(JSON.stringify(event)).not.toMatch(/ebay\.com|Camry|Toyota|Brake Pads/)
  expect(page.context().pages()).toHaveLength(1)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})
