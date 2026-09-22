import { expect } from '@playwright/test'
import { test, assertNoUnexpectedRuntimeErrors } from './helpers/fixture'
import { expectResults, goToResults } from './helpers/journey'

const historyRoute = /\/api\/price-history(?:\?|$)/
const observations = Array.from({ length: 5 }, (_, index) => ({ date: `2026-01-0${index + 1}`, price: 50 - index }))

test('optional history loads after usable results and preserves the selected listing', async ({ page, app, fixtureServer }, testInfo) => {
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  let requests = 0
  await page.route(historyRoute, async route => {
    requests += 1
    await held
    await route.fulfill({ json: { observations } })
  })
  try {
    await goToResults(page, app.baseUrl)
    await expect.poll(() => requests).toBe(1)
    await expect(page.getByRole('img', { name: /^Price history:/ })).toHaveCount(0)
    const compare = page.locator('.listing-card').first().getByRole('button', { name: 'Compare', exact: true })
    await compare.click()
    release()
    await expect(page.getByRole('img', { name: 'Price history: low $46.00, high $50.00, latest $46.00' })).toBeVisible()
    await expect(page.getByText('Select one more part to compare', { exact: true })).toBeVisible()
    await expectResults(page)
    expect(requests).toBe(1)
  } finally {
    release()
  }
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('missing or failed optional history never hides successful search results', async ({ page, app, fixtureServer }, testInfo) => {
  await page.route(historyRoute, route => route.fulfill({ json: { observations: [] } }))
  await goToResults(page, app.baseUrl)
  await expect(page.getByRole('img', { name: /^Price history:/ })).toHaveCount(0)
  await page.unroute(historyRoute)
  await page.route(historyRoute, route => route.fulfill({ status: 503, json: { error: 'Intentional history outage' } }))
  const failed = page.waitForResponse(response => historyRoute.test(response.url()) && response.status() === 503)
  await page.reload()
  await failed
  await expectResults(page)
  await expect(page.getByText("We couldn't complete this search.")).toHaveCount(0)
  await expect(page.getByRole('img', { name: /^Price history:/ })).toHaveCount(0)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo, [/503|Service Unavailable/])
})
