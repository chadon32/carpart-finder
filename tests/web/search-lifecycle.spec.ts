import { expect, type Page } from '@playwright/test'
import { test, assertNoUnexpectedRuntimeErrors } from './helpers/fixture'
import { expectResults, fixtureRoute, goToResults } from './helpers/journey'

const searchRoute = /\/api\/search(?:\?|$)/

function gate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => { release = resolve })
  return { promise, release }
}

async function changeZip(page: Page, zip: string) {
  const phone = await page.evaluate(() => window.innerWidth < 640)
  if (phone) await page.getByRole('button', { name: 'Filters' }).click()
  const input = phone
    ? page.getByRole('dialog', { name: 'Filter listings' }).getByRole('textbox', { name: 'Delivery ZIP code' })
    : page.getByRole('textbox', { name: 'Delivery ZIP code' })
  await input.fill(zip)
  if (phone) await page.getByRole('button', { name: 'Show results' }).click()
  else await input.press('Enter')
}

test('starts exactly one search while the results screen code is still loading', async ({ page, app, fixtureServer }, testInfo) => {
  const screen = gate()
  let screenRequests = 0
  let searchRequests = 0
  await page.route(/\/ResultsList-[^/]+\.js$/, async (route) => {
    screenRequests += 1
    await screen.promise
    await route.continue()
  })
  page.on('request', (request) => {
    if (searchRoute.test(request.url())) searchRequests += 1
  })
  try {
    await page.goto(`${app.baseUrl}/${fixtureRoute}`, { waitUntil: 'domcontentloaded' })
    await expect.poll(() => screenRequests).toBe(1)
    await expect.poll(() => searchRequests).toBe(1)
    await expect(page.locator('.listing-card')).toHaveCount(0)
  } finally {
    screen.release()
  }
  await expectResults(page)
  expect(searchRequests).toBe(1)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('changing ZIP hides obsolete results and persists one replacement search', async ({ page, app, fixtureServer }, testInfo) => {
  await goToResults(page, app.baseUrl)
  const latest = gate()
  const zipRequests: string[] = []
  await page.route(searchRoute, async (route) => {
    const zip = new URL(route.request().url()).searchParams.get('zip') ?? ''
    zipRequests.push(zip)
    const response = await route.fetch()
    const body = await response.json()
    body.results = body.results.map((listing: { title: string }) => ({ ...listing, title: `${zip} replacement listing` }))
    await latest.promise
    await route.fulfill({ response, json: body })
  })
  try {
    await changeZip(page, '90210')
    await expect.poll(() => zipRequests).toEqual(['90210'])
    await expect(page.locator('.listing-card')).toHaveCount(0)
    latest.release()
    await expectResults(page)
    await expect(page.locator('.listing-card').first()).toContainText('90210 replacement listing')
    expect(zipRequests).toEqual(['90210'])
    await page.reload()
    await expectResults(page)
    expect(zipRequests).toEqual(['90210', '90210'])
  } finally {
    latest.release()
  }
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('leaving results aborts an in-flight search and keeps the home screen usable', async ({ page, app, fixtureServer }, testInfo) => {
  const responseGate = gate()
  let searchRequests = 0
  let aborted = 0
  page.on('requestfailed', (request) => {
    if (searchRoute.test(request.url())) aborted += 1
  })
  await page.route(searchRoute, async (route) => {
    searchRequests += 1
    await responseGate.promise
    await route.continue()
  })
  try {
    await page.goto(`${app.baseUrl}/${fixtureRoute}`, { waitUntil: 'domcontentloaded' })
    await expect.poll(() => searchRequests).toBe(1)
    await page.getByRole('button', { name: /CarPartsRadar/ }).click()
    await expect(page.getByRole('combobox', { name: 'Year', exact: true })).toBeVisible()
    await expect.poll(() => aborted).toBe(1)
  } finally {
    responseGate.release()
  }
  await expect(page.getByRole('combobox', { name: 'Make', exact: true })).toBeEnabled()
  await expect(page.locator('.listing-card')).toHaveCount(0)
  expect(searchRequests).toBe(1)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})
