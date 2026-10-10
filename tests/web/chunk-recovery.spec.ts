import { expect } from '@playwright/test'
import { test, assertNoUnexpectedRuntimeErrors } from './helpers/fixture'
import { expectResults } from './helpers/journey'

// The results screen is a separate download. When it cannot be fetched (the
// connection drops, or a new release replaced the file the open tab expects)
// the page used to go completely blank and stay that way. It should say what
// happened and offer a way back.
const expectedFailures = [/Failed to load resource/i, /dynamically imported module/i, /ResultsList/i, /net::ERR/i, /Importing a module script failed/i, /Screen failed to render/i, /boom/i, /^Error$/, /JSHandle@object/]
const partStep = '?year=2020&make=Toyota&model=Camry&trim=LE'
const resultsChunk = /\/assets\/ResultsList-[^/]*\.js/

test('a results screen that will not download shows a retry, not a blank page', async ({ page, app, fixtureServer, browserName }, testInfo) => {
  await page.goto(`${app.baseUrl}/${partStep}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('combobox', { name: 'Part search' })).toBeVisible()

  const block = (route: { abort: (reason?: string) => Promise<void> }) => route.abort('failed')
  await page.route(resultsChunk, block)
  await page.getByRole('button', { name: 'Brake Pads', exact: true }).click()

  // The site answers but the file does not, which is what a replaced release
  // looks like: the page reloads once on its own, then explains instead of
  // looping.
  const alert = page.getByRole('alert').filter({ hasText: /didn.t load/i })
  await expect(alert).toBeVisible({ timeout: 20_000 })
  await expect(page).toHaveURL(/part=Brake\+Pads/)

  await page.unroute(resultsChunk, block)
  // Playwright's WebKit keeps the blocked download cached across a reload, so
  // the recovery step can only be exercised in the other engines.
  if (browserName !== 'webkit') {
    await alert.getByRole('button', { name: 'Try again' }).click()
    await expectResults(page)
  }
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo, expectedFailures)
})

test('losing the connection before the results screen loads explains it and recovers once it is back', async ({ page, app, fixtureServer, browserName }, testInfo) => {
  await page.goto(`${app.baseUrl}/${partStep}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('combobox', { name: 'Part search' })).toBeVisible()

  await page.context().setOffline(true)
  await page.getByRole('button', { name: 'Brake Pads', exact: true }).click()

  const alert = page.getByRole('alert').filter({ hasText: /didn.t load/i })
  await expect(alert).toBeVisible({ timeout: 20_000 })
  // Offline is not a stale release: reloading would only swap the app for the
  // browser's own error page, so the page must still be the app.
  await expect(page).toHaveURL(/part=Brake\+Pads/)

  await alert.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText(/Still can.t reach CarPartsRadar/)).toBeVisible()

  await page.context().setOffline(false)
  if (browserName !== 'webkit') {
    await alert.getByRole('button', { name: 'Try again' }).click()
    await expectResults(page)
  }
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo, expectedFailures)
})

test('a screen that throws shows a way back to the home page', async ({ page, app, fixtureServer }, testInfo) => {
  await page.goto(`${app.baseUrl}/${partStep}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('combobox', { name: 'Part search' })).toBeVisible()

  await page.route(resultsChunk, (route) => route.fulfill({ contentType: 'text/javascript', body: 'throw new Error("boom")' }))
  await page.getByRole('button', { name: 'Brake Pads', exact: true }).click()

  const alert = page.getByRole('alert').filter({ hasText: /went wrong/i })
  await expect(alert).toBeVisible({ timeout: 20_000 })
  await expect(alert.getByRole('link', { name: 'Start over' })).toHaveAttribute('href', '/')
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo, expectedFailures)
})
