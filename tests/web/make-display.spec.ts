import { expect } from '@playwright/test'
import { test, assertNoUnexpectedRuntimeErrors } from './helpers/fixture'
import { chooseCombobox } from './helpers/journey'

// NHTSA returns makes in upper case. The app should show, store, and put in
// URLs the readable spelling, and old upper-case links and saved vehicles
// should keep working. Text assertions are case-sensitive on purpose: Playwright's
// default getByText ignores case, which would hide exactly this bug.

test('makes from the API are shown and stored in readable case', async ({ page, app, fixtureServer }, testInfo) => {
  await page.route(/\/api\/makes(?:\?|$)/, (route) => route.fulfill({ json: { makes: ['HONDA', 'MERCEDES-BENZ', 'TOYOTA'] } }))
  await page.goto(app.baseUrl, { waitUntil: 'domcontentloaded' })

  await chooseCombobox(page, 'Year', '2020')
  await chooseCombobox(page, 'Make', 'Toyota')
  await chooseCombobox(page, 'Model', 'Camry')
  await page.getByRole('button', { name: 'Continue to parts' }).click()

  await expect(page).toHaveURL(/[?&]make=Toyota(?:&|$)/)
  await expect(page.getByText('2020 Toyota Camry', { exact: true })).toBeVisible()
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('an old upper-case link opens with the readable make', async ({ page, app, fixtureServer }, testInfo) => {
  await page.goto(`${app.baseUrl}/?year=2020&make=TOYOTA&model=Camry`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What part do you need?')
  await expect(page.getByText('2020 Toyota Camry', { exact: true })).toBeVisible()
  await expect(page.getByText(/TOYOTA/)).toHaveCount(0)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('a vehicle saved before this change shows the readable make in the garage', async ({ page, app, fixtureServer }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem('carpartsradar-garage', JSON.stringify([{ year: '2020', make: 'TOYOTA', model: 'Camry', trim: 'LE' }]))
  })
  await page.goto(app.baseUrl, { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('2020 Toyota Camry', { exact: true })).toBeVisible()
  await expect(page.getByText(/TOYOTA/)).toHaveCount(0)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})
