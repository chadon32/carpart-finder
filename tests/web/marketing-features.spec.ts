import { expect } from '@playwright/test'
import { test, assertNoUnexpectedRuntimeErrors } from './helpers/fixture'
import { chooseFixtureVehicle, expectNoHorizontalOverflow, expectResults, goToResults } from './helpers/journey'

const searchRoute = /\/api\/search(?:\?|$)/

test('copies a privacy-safe comparison checklist with fitment and cost caveats', async ({ page, app, fixtureServer }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (value: string) => {
          const target = window as Window & { __comparisonCopy?: string }
          target.__comparisonCopy = value
          return Promise.resolve()
        },
      },
    })
  })

  await goToResults(page, app.baseUrl)
  await page.locator('.listing-card').nth(1).getByRole('button', { name: 'Compare', exact: true }).click()
  await page.locator('.listing-card').nth(0).getByRole('button', { name: 'Compare', exact: true }).click()
  await page.getByRole('button', { name: 'Compare Now' }).click()

  const comparison = page.getByRole('dialog', { name: 'Compare listings' })
  await expect(comparison.getByRole('heading', { name: 'Fitment and delivered-cost checklist' })).toBeVisible()
  await expect(comparison).toContainText('Structured compatibility evidence')
  await expect(comparison).toContainText('Core charge')
  await expect(comparison).toContainText('Unavailable')
  await expect(comparison).toContainText('Fitment evidence checked')
  await expect(comparison).toContainText('Listing freshness')
  await expect(comparison).not.toContainText('Listing timestamp')
  await expect(comparison).toContainText('do not establish compatibility')
  await expect(comparison).toContainText('does not guarantee fitment, price, inventory, delivery, or savings')
  await expect(comparison).toContainText('As an Amazon Associate')

  await comparison.getByRole('button', { name: 'Copy checklist' }).click()
  await expect(comparison.getByRole('button', { name: 'Copied' })).toBeVisible()
  const copied = await page.evaluate(() => (window as Window & { __comparisonCopy?: string }).__comparisonCopy)
  expect(copied).toContain('Vehicle: 2020 Toyota Camry LE')
  expect(copied).toContain('Part: Brake Pads')
  expect(copied).toContain('Structured compatibility evidence')
  expect(copied).toContain('Core charge: Unavailable')
  expect(copied).toContain('Affiliate disclosure:')
  expect(copied).not.toContain('VIN:')
  expect(copied).not.toContain('example.invalid')
  await expectNoHorizontalOverflow(page, 'comparison checklist')
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('guide links open an editable part starting state after vehicle confirmation', async ({ page, app, fixtureServer }, testInfo) => {
  let searches = 0
  page.on('request', (request) => {
    if (searchRoute.test(request.url())) searches += 1
  })

  await page.goto(`${app.baseUrl}/?guide=compare-total-car-part-cost`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'How to Compare the Real Cost of an Online Car Part' })).toBeVisible()
  await expect(page.getByText('You can edit the part category before any listings are searched.')).toBeVisible()
  await chooseFixtureVehicle(page)
  await expect(page.getByRole('combobox', { name: 'Part search' })).toHaveValue('Brake Pads')
  await expect(page.getByRole('button', { name: 'Search Brake Pads' })).toBeVisible()
  expect(searches).toBe(0)

  const partSearch = page.getByRole('combobox', { name: 'Part search' })
  await partSearch.fill('Alternator')
  await expect(page.getByRole('button', { name: 'Search Alternator' })).toBeVisible()
  expect(searches).toBe(0)

  await partSearch.fill('Brake Pads')
  await expect(page.getByRole('button', { name: 'Search Brake Pads' })).toBeVisible()
  await page.getByRole('button', { name: 'Search Brake Pads' }).click()
  await expectResults(page)
  await expect(page.getByRole('link', { name: /Read the matching guide: How to Confirm a Car Part Fits/i })).toHaveAttribute(
    'href',
    '/guides/how-to-confirm-car-part-fitment.html',
  )
  expect(searches).toBe(1)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('photo search presents the local illustrative demo without an identification request', async ({ page, app, fixtureServer }, testInfo) => {
  let identificationRequests = 0
  page.on('request', (request) => {
    if (request.url().includes('/api/identify-part')) identificationRequests += 1
  })

  await page.goto(app.baseUrl, { waitUntil: 'domcontentloaded' })
  await chooseFixtureVehicle(page)
  await page.getByRole('tab', { name: 'Photo Search' }).click()
  await expect(page.getByRole('heading', { name: 'What photo search can extract' })).toBeVisible()
  await expect(page.getByRole('img', { name: /Original vector illustration/i })).toHaveAttribute('src', '/editorial/parts-workbench-demo.svg')
  await expect(page.getByText('Original local vector illustration.')).toBeVisible()
  await expect(page.getByText('without calling Gemini')).toBeVisible()
  await expect(page.getByText('Exact part number, options, and fitment')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Use your own photo' })).toBeVisible()
  expect(identificationRequests).toBe(0)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})
