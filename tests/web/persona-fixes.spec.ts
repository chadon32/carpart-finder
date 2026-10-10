import { expect, type Page } from '@playwright/test'
import { test, assertNoUnexpectedRuntimeErrors } from './helpers/fixture'

// Fixes found by walking the live site as four different users (a phone user
// shopping for the right axle, a low-vision laptop user, a user on a slow
// phone, and a mechanic searching by part number).

const vehicle = { year: '2020', make: 'Toyota', model: 'Camry' }

function listing(id: string, title: string, price: number, extra: Record<string, unknown> = {}) {
  return {
    id, title, price, currency: 'USD', condition: 'New', seller: `seller-${id}`, sellerFeedbackPercentage: '99.0',
    sellerFeedbackScore: 1200, image: null, link: `https://www.ebay.com/itm/${id}`, source: 'eBay', crossBorder: false,
    shippingCost: 0, verifiedFitment: true, fitmentTier: 'verified', fitmentProof: 'proof',
    fitmentEvidence: { provider: 'eBay', matchType: 'EXACT', scope: 'year-make-model', matchedVehicle: vehicle, checkedAt: '2026-01-01T00:00:00.000Z', note: 'fixture' },
    ...extra,
  }
}

const unconfirmed = (id: string, title: string, price: number, extra: Record<string, unknown> = {}) =>
  listing(id, title, price, { verifiedFitment: false, fitmentTier: 'fallback', fitmentProof: null, fitmentEvidence: { ...listing(id, title, price).fitmentEvidence, matchType: null, matchedVehicle: vehicle }, ...extra })

async function mockSearch(page: Page, body: Record<string, unknown>) {
  // The fixture server only knows one search, so give any other search the
  // price history it would have fetched.
  await page.route(/\/api\/price-history\?/, (route) => route.fulfill({ json: { observations: [] } }))
  await page.route(/\/api\/search\?/, (route) => route.fulfill({
    json: { fitmentContractVersion: 2, query: 'q', results: [], fallbackResults: [], fitmentSummary: { verified: 0, fallback: 0 }, providerErrors: {}, skippedProviders: [], ...body },
  }))
}

const searchUrl = (baseUrl: string, part = 'Brake+Pads') => `${baseUrl}/?year=2020&make=Toyota&model=Camry&trim=LE&part=${part}`
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1000) < 640

// ---- M1: which axle ---------------------------------------------------------

test('brake pads for different axles are separated, and no listing is crowned best across them', async ({ page, app, fixtureServer }, testInfo) => {
  const results = [
    listing('rear', 'Rear Ceramic Brake Pads Set for Toyota Camry', 17),
    listing('f1', 'Front Ceramic Brake Pads for Toyota Camry', 21),
    listing('f2', 'Front Brake Pads Premium for Toyota Camry', 24),
    listing('kit', 'Front and Rear Ceramic Brake Pads Kit for Toyota Camry', 33),
  ]
  await mockSearch(page, { results, fitmentSummary: { verified: 4, fallback: 0 } })
  await page.goto(searchUrl(app.baseUrl), { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.listing-card')).toHaveCount(4)

  const axle = page.getByRole('group', { name: 'Axle' })
  await expect(axle.getByRole('button', { name: /^All/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(axle.getByRole('button', { name: /^Front \d/ })).toBeVisible()
  await expect(axle.getByRole('button', { name: /^Rear \d/ })).toBeVisible()
  await expect(axle.getByRole('button', { name: /^Front \+ rear \d/ })).toBeVisible()

  // Mixed axles: the cheapest rear set must not be labeled the lowest total.
  const cards = page.locator('.listing-card')
  await expect(cards.getByText('Lowest known total')).toHaveCount(0)
  await expect(cards.getByText('Best value estimate')).toHaveCount(0)

  await axle.getByRole('button', { name: /^Front \d/ }).click()
  await expect(page.locator('.listing-card')).toHaveCount(2)
  await expect(page.locator('.listing-card').first()).toContainText('Front Ceramic Brake Pads')
  await expect(cards.getByText('Lowest known total')).toHaveCount(1)

  await axle.getByRole('button', { name: /^Rear \d/ }).click()
  await expect(page.locator('.listing-card')).toHaveCount(1)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('parts that are not per-axle never show the axle choice', async ({ page, app, fixtureServer }, testInfo) => {
  await mockSearch(page, { results: [listing('a', 'Front Oil Filter A', 8), listing('b', 'Rear Oil Filter B', 9)], fitmentSummary: { verified: 2, fallback: 0 } })
  await page.goto(searchUrl(app.baseUrl, 'Oil+Filter'), { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.listing-card')).toHaveCount(2)
  await expect(page.getByRole('group', { name: 'Axle' })).toHaveCount(0)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

// ---- D1: part numbers -------------------------------------------------------

test('a part-number search says what the listings do and do not show', async ({ page, app, fixtureServer }, testInfo) => {
  await mockSearch(page, {
    partNumberSearch: true,
    fallbackResults: [unconfirmed('pn1', 'Genuine Oil Filter 26350-2T000 for Genesis G70', 9, { partNumberMatch: 'exact' })],
    fitmentSummary: { verified: 0, fallback: 1 },
  })
  await page.goto(searchUrl(app.baseUrl, '26350-2T000'), { waitUntil: 'domcontentloaded' })

  await expect(page.getByRole('heading', { name: 'Listings that mention part number 26350-2T000' })).toBeVisible()
  await expect(page.getByText(/can.t confirm (?:they|it) fit your 2020 Toyota Camry/i)).toBeVisible()
  await expect(page.locator('.listing-card').first()).toContainText('Part number in title')
  await expect(page.getByText(/None of these are confirmed for your/)).toHaveCount(0)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('a part-number search with only related listings says no listing states the number', async ({ page, app, fixtureServer }, testInfo) => {
  await mockSearch(page, {
    partNumberSearch: true,
    fallbackResults: [unconfirmed('pn2', 'Front Brake Pads for 2020 Toyota Camry', 25, { partNumberMatch: 'related' })],
    fitmentSummary: { verified: 0, fallback: 1 },
  })
  await page.goto(searchUrl(app.baseUrl, '04465-0K010'), { waitUntil: 'domcontentloaded' })

  await expect(page.getByRole('heading', { name: 'No listing states part number 04465-0K010' })).toBeVisible()
  await expect(page.locator('.listing-card').first()).not.toContainText('Part number in title')
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

// ---- M2: eBay's model names -------------------------------------------------

test('listings matched under a more specific eBay model name say which one', async ({ page, app, fixtureServer }, testInfo) => {
  const withModel = (model: string) => ({ fitmentEvidence: { ...listing('x', 'x', 1).fitmentEvidence, matchedVehicle: { ...vehicle, model } } })
  await mockSearch(page, {
    results: [
      listing('v1', 'Cabin Air Filter for Toyota Camry SE', 12, withModel('Camry SE')),
      listing('v2', 'Cabin Air Filter for Toyota Camry XLE', 14, withModel('Camry XLE')),
    ],
    fitmentSummary: { verified: 2, fallback: 0, matchedModels: ['Camry SE', 'Camry XLE'] },
  })
  await page.goto(searchUrl(app.baseUrl, 'Cabin+Air+Filter'), { waitUntil: 'domcontentloaded' })

  await expect(page.getByText(/eBay lists this vehicle as Camry SE and Camry XLE/)).toBeVisible()
  await expect(page.locator('.listing-card').first()).toContainText('Matches Camry SE')
  await expect(page.locator('.listing-card').nth(1)).toContainText('Matches Camry XLE')
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

// ---- D2: more than 15 ------------------------------------------------------

test('listings beyond the first page are one tap away', async ({ page, app, fixtureServer }, testInfo) => {
  const results = Array.from({ length: 20 }, (_, i) => listing(`m${i}`, `Oil Filter Model ${i} for Toyota Camry`, 10 + i))
  await mockSearch(page, { results, fitmentSummary: { verified: 20, fallback: 0 } })
  await page.goto(searchUrl(app.baseUrl, 'Oil+Filter'), { waitUntil: 'domcontentloaded' })

  await expect(page.locator('.listing-card')).toHaveCount(15)
  await page.getByRole('button', { name: 'Show 5 more listings' }).click()
  await expect(page.locator('.listing-card')).toHaveCount(20)
  await expect(page.getByRole('button', { name: /Show .* more listings/ })).toHaveCount(0)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

// ---- M3, M5, M6, M7: small screens ------------------------------------------

test('on a phone the first listing is on the first screen and save/share are labeled', async ({ page, app, fixtureServer }, testInfo) => {
  test.skip(!isPhone(page), 'phone layout only')
  await mockSearch(page, { results: [listing('p1', 'Front Ceramic Brake Pads for Toyota Camry', 21), listing('p2', 'Front Brake Pads Premium', 24)], fitmentSummary: { verified: 2, fallback: 0 } })
  await page.goto(searchUrl(app.baseUrl), { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.listing-card')).toHaveCount(2)

  const top = await page.locator('.listing-card').first().evaluate((el) => el.getBoundingClientRect().top)
  expect(top, 'first listing should start on the first screen').toBeLessThan(page.viewportSize()!.height - 120)
  await expect(page.getByRole('navigation', { name: 'Search progress' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Save search' })).toContainText('Save')
  await expect(page.getByRole('button', { name: 'Copy share link' })).toContainText('Share')
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('on a phone the model list opens where it can be seen', async ({ page, app, fixtureServer }, testInfo) => {
  test.skip(!isPhone(page), 'phone layout only')
  await page.goto(app.baseUrl, { waitUntil: 'domcontentloaded' })
  await page.getByRole('combobox', { name: 'Year', exact: true }).click()
  await page.keyboard.type('2020')
  await page.keyboard.press('Enter')
  await page.getByRole('combobox', { name: 'Make', exact: true }).click()
  await page.keyboard.type('Toyota')
  await page.keyboard.press('Enter')
  const model = page.getByRole('combobox', { name: 'Model', exact: true })
  await expect(model).toBeEnabled()
  await model.click()

  const option = page.getByRole('option', { name: 'Camry' })
  await expect(option).toBeVisible()
  // Nothing (such as the bottom bar) may cover the option.
  await expect.poll(() => option.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return Boolean(hit && el.contains(hit))
  })).toBe(true)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('the details sheet on a phone leads with the listing, not just a photo', async ({ page, app, fixtureServer }, testInfo) => {
  test.skip(!isPhone(page), 'phone layout only')
  await mockSearch(page, { results: [listing('d1', 'Front Ceramic Brake Pads for Toyota Camry', 21.99), listing('d2', 'Front Brake Pads Premium', 24)], fitmentSummary: { verified: 2, fallback: 0 } })
  await page.goto(searchUrl(app.baseUrl), { waitUntil: 'domcontentloaded' })
  await page.locator('.listing-card').first().getByRole('button', { name: 'Details', exact: true }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Front Ceramic Brake Pads for Toyota Camry' })).toBeInViewport()
  await expect(dialog.getByText('$21.99')).toBeInViewport()
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('a short screen (a laptop at 200% zoom) does not keep the header pinned', async ({ page, app, fixtureServer }, testInfo) => {
  await page.setViewportSize({ width: 640, height: 360 })
  await page.goto(app.baseUrl, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('combobox', { name: 'Year', exact: true })).toBeVisible()
  const position = await page.locator('header').first().evaluate((el) => getComputedStyle(el).position)
  expect(position).not.toBe('sticky')
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

// ---- D5, D6: assistive technology and sign-in prompt -----------------------

test('results are announced, focus goes to the heading, and photos are not read twice', async ({ page, app, fixtureServer }, testInfo) => {
  await mockSearch(page, { results: [listing('a1', 'Front Ceramic Brake Pads for Toyota Camry', 21, { image: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }), listing('a2', 'Front Brake Pads Premium', 24)], fitmentSummary: { verified: 2, fallback: 0 } })
  await page.goto(app.baseUrl, { waitUntil: 'domcontentloaded' })
  await page.getByRole('combobox', { name: 'Year', exact: true }).click()
  await page.keyboard.type('2020')
  await page.keyboard.press('Enter')
  await page.getByRole('combobox', { name: 'Make', exact: true }).click()
  await page.keyboard.type('Toyota')
  await page.keyboard.press('Enter')
  const model = page.getByRole('combobox', { name: 'Model', exact: true })
  await expect(model).toBeEnabled()
  await model.click()
  await page.keyboard.type('Camry')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Continue to parts' }).last().click()
  await page.getByRole('button', { name: 'Brake Pads', exact: true }).click()

  await expect(page.locator('.listing-card')).toHaveCount(2)
  await expect(page.getByRole('status').filter({ hasText: /2 listings match your 2020 Toyota Camry/ })).toHaveCount(1)
  await expect(page.getByRole('heading', { level: 1, name: 'Brake Pads' })).toBeFocused()
  expect(await page.locator('.listing-card img:not([alt=""])').count()).toBe(0)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('asking to save a search while signed out is a prompt, not an error', async ({ page, app, fixtureServer }, testInfo) => {
  await mockSearch(page, { results: [listing('s1', 'Front Ceramic Brake Pads', 21), listing('s2', 'Front Brake Pads Premium', 24)], fitmentSummary: { verified: 2, fallback: 0 } })
  await page.route(/\/api\/supabase\/saved-searches/, (route) => route.fulfill({ status: 401, json: { error: 'Not authenticated' } }))
  await page.goto(searchUrl(app.baseUrl), { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Save search' }).click()

  await expect(page.getByText('Sign in or create an account to save this search.')).toBeVisible()
  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo, [/401|Unauthorized|Not authenticated|Failed to load resource/i])
})

// ---- L2, J2: the part box and the symptom box -------------------------------

test('typing a part in your own words offers the matching part first', async ({ page, app, fixtureServer }, testInfo) => {
  await mockSearch(page, { results: [listing('c1', 'Cabin Air Filter for Toyota Camry', 12), listing('c2', 'Cabin Air Filter Carbon for Toyota Camry', 15)], fitmentSummary: { verified: 2, fallback: 0 } })
  await page.goto(`${app.baseUrl}/?year=2020&make=Toyota&model=Camry&trim=LE`, { waitUntil: 'domcontentloaded' })
  const box = page.getByRole('combobox', { name: 'Part search' })
  await box.click()
  await page.keyboard.type('cabin filter')
  await expect(page.getByRole('option').first()).toHaveText('Cabin Air Filter')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/part=Cabin\+Air\+Filter/)
  // Let the results screen finish its requests inside this test.
  await expect(page.locator('.listing-card')).toHaveCount(2)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo, [/Failed to load resource/i])
})

test('a check-engine light in the symptom box points to the error-code tab', async ({ page, app, fixtureServer }, testInfo) => {
  await page.goto(`${app.baseUrl}/?year=2020&make=Toyota&model=Camry&trim=LE`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('tab', { name: 'Describe a Problem' }).click()
  await page.getByRole('tabpanel').locator('textarea, input').first().fill('check engine light is on and the car shakes')
  const hint = page.getByText(/read the code for free/i)
  await expect(hint).toBeVisible()
  await hint.locator('xpath=..').getByRole('button', { name: /Error Code/ }).click()
  await expect(page.getByRole('tab', { name: 'Error Code (OBD-II)' })).toHaveAttribute('aria-selected', 'true')
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo, [/Failed to load resource/i])
})
