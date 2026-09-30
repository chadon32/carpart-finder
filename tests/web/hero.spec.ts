import { expect } from '@playwright/test'
import { test, assertNoUnexpectedRuntimeErrors } from './helpers/fixture'

// The vehicle form is the page's job, so it must be reachable without
// scrolling past marketing, and the page must say what it does in plain words.

test('the home page names what it does and puts the vehicle form on the first screen', async ({ page, app, fixtureServer }, testInfo) => {
  await page.goto(app.baseUrl, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Compare car part prices for your vehicle.')

  for (const name of ['Year', 'Make', 'Model']) {
    await expect(page.getByRole('combobox', { name, exact: true }), `${name} is on the first screen`).toBeInViewport()
  }
  // The step tracker and the three repeated value claims are gone from this step.
  await expect(page.getByRole('navigation', { name: 'Search progress' })).toHaveCount(0)
  await expect(page.getByText('Live scan')).toHaveCount(0)
  await expect(page.getByText('Evidence shown for every match')).toHaveCount(0)
  await expect(page.getByText('Vehicle type', { exact: true })).toHaveCount(0)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('the step tracker returns once a vehicle is chosen', async ({ page, app, fixtureServer }, testInfo) => {
  await page.goto(`${app.baseUrl}/?year=2020&make=Toyota&model=Camry`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('navigation', { name: 'Search progress' })).toBeVisible()
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('a VIN can be decoded from a disclosure that stays closed by default', async ({ page, app, fixtureServer }, testInfo) => {
  await page.route(/\/api\/vin(?:\?|$)/, (route) => route.fulfill({
    json: { year: '2020', make: 'TOYOTA', model: 'Camry', trim: 'LE', engine: { displacementL: '2.5', cylinders: '4', driveType: 'FWD', fuelType: 'Gasoline' } },
  }))
  await page.goto(app.baseUrl, { waitUntil: 'domcontentloaded' })

  const toggle = page.getByRole('button', { name: /Have a VIN/ })
  const vin = page.getByLabel('Vehicle identification number (VIN)')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(vin).toBeHidden()

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await vin.fill('4T1B11HK5KU123456')
  await page.getByRole('button', { name: 'Decode', exact: true }).click()

  await expect(page.getByRole('combobox', { name: 'Year', exact: true })).toHaveValue('2020')
  await expect(page.getByRole('combobox', { name: 'Make', exact: true })).toHaveValue('Toyota')
  await expect(page.getByRole('combobox', { name: 'Model', exact: true })).toHaveValue('Camry')
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})
