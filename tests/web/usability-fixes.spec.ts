import { expect } from '@playwright/test'
import { test, assertNoUnexpectedRuntimeErrors } from './helpers/fixture'
import { fillCombobox, fixtureRoute, goToResults, openDetails } from './helpers/journey'

const searchRoute = /\/api\/search(?:\?|$)/

test('typing a year and pressing Tab keeps the year', async ({ page, app, fixtureServer }, testInfo) => {
  await page.goto(app.baseUrl, { waitUntil: 'domcontentloaded' })
  await fillCombobox(page, 'Year', '2020')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('combobox', { name: 'Year', exact: true })).toHaveValue('2020')
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('typing part of a make and pressing Enter selects the match', async ({ page, app, fixtureServer }, testInfo) => {
  await page.goto(app.baseUrl, { waitUntil: 'domcontentloaded' })
  await fillCombobox(page, 'Make', 'toy')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('combobox', { name: 'Make', exact: true })).toHaveValue('Toyota')
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('Enter immediately after the last keystroke still selects the match', async ({ page, app, fixtureServer }, testInfo) => {
  await page.goto(app.baseUrl, { waitUntil: 'domcontentloaded' })
  const make = page.getByRole('combobox', { name: 'Make', exact: true })
  await expect(make).toBeEnabled()
  await make.click()
  // Type and press Enter in one task, as fast typing or autofill can, so no
  // render can land between the last keystroke and the Enter.
  await make.evaluate((input: HTMLInputElement) => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    setValue.call(input, 'toy')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  })
  await expect(make).toHaveValue('Toyota')
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('typing an exact year and clicking away keeps the year', async ({ page, app, fixtureServer }, testInfo) => {
  await page.goto(app.baseUrl, { waitUntil: 'domcontentloaded' })
  await fillCombobox(page, 'Year', '2020')
  await page.getByRole('heading', { name: 'Select your vehicle' }).click()
  // The list closes on a short blur timer; judge the field only after it has.
  await expect(page.getByRole('listbox', { name: 'Year' })).toBeHidden()
  await expect(page.getByRole('combobox', { name: 'Year', exact: true })).toHaveValue('2020')
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('results start sorted by lowest known total, with unknown shipping last', async ({ page, app, fixtureServer }, testInfo) => {
  await page.route(searchRoute, async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    const [template] = body.results
    body.results = [
      { ...template, id: 'unknown-shipping', seller: 'Seller A', title: 'Cheapest item, shipping unknown', price: 5, shippingCost: null },
      { ...template, id: 'paid-shipping', seller: 'Seller B', title: 'Middle item, paid shipping', price: 12, shippingCost: 15 },
      { ...template, id: 'free-shipping', seller: 'Seller C', title: 'Priciest item, free shipping', price: 20, shippingCost: 0 },
    ]
    body.fitmentSummary = { ...body.fitmentSummary, verified: body.results.length }
    await route.fulfill({ response, json: body })
  })
  await page.goto(`${app.baseUrl}/${fixtureRoute}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.listing-card h3')).toHaveText([
    'Priciest item, free shipping',
    'Middle item, paid shipping',
    'Cheapest item, shipping unknown',
  ])
  if ((page.viewportSize()?.width ?? 0) >= 640) {
    await expect(page.getByRole('combobox', { name: 'Sort listings' })).toHaveValue('total')
  } else {
    // On phones the sort lives in the sort and filter sheet.
    await page.getByRole('button', { name: 'Sort & filters' }).click()
    await expect(page.getByRole('radio', { name: 'Lowest total (with shipping)' })).toBeChecked()
  }
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('listing details keep the close and retailer actions on screen', async ({ page, app, fixtureServer }, testInfo) => {
  test.skip((page.viewportSize()?.width ?? 0) < 640, 'Phones use a bottom sheet that already pins its actions')
  await goToResults(page, app.baseUrl)
  await openDetails(page)
  const details = page.getByRole('dialog', { name: /listing details/ })
  // Fixture listing links are rejected by the outbound-URL guard, so assert on
  // the footer action row through the Watchlist button that shares it.
  await expect(details.getByRole('button', { name: 'Add to Watchlist' })).toBeInViewport()
  await details.getByRole('link', { name: 'How affiliate links work' }).scrollIntoViewIfNeeded()
  await expect(details.getByLabel('Close')).toBeInViewport()
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('part selection has one level-one heading', async ({ page, app, fixtureServer }, testInfo) => {
  await page.goto(`${app.baseUrl}/?year=2020&make=Toyota&model=Camry`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What part do you need?')
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('first-time visitors see no empty Garage or Recent searches placeholders', async ({ page, app, fixtureServer }, testInfo) => {
  await page.goto(app.baseUrl, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('combobox', { name: 'Year', exact: true })).toBeVisible()
  await expect(page.getByText('My Garage')).toHaveCount(0)
  await expect(page.getByText('Recent searches')).toHaveCount(0)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('each listing offers a plainly named Details action', async ({ page, app, fixtureServer }, testInfo) => {
  await goToResults(page, app.baseUrl)
  await expect(page.locator('.listing-card').first().getByRole('button', { name: 'Details', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Click for Detailed View/ })).toHaveCount(0)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})
