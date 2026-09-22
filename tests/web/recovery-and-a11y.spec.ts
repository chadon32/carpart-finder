import { expect, type Page, type TestInfo } from '@playwright/test'
import { test, assertNoUnexpectedRuntimeErrors, type RuntimeError } from './helpers/fixture'
import { createWcagAaCollector } from './helpers/a11y'
import { chooseFixtureVehicle, expectNoHorizontalOverflow, expectResults, goToResults, openDetails, openGuestAccount, openWatchlist } from './helpers/journey'

const searchRoute = /\/api\/search(?:\?|$)/

type AppHarness = { baseUrl: string; runtimeErrors: RuntimeError[] }
type FixtureHarness = { url: string; unexpectedRequests: string[]; close: () => Promise<void> }

test('empty, error, slow, and offline search responses have explicit recovery', async ({ page, app, fixtureServer }, testInfo) => {
  await page.route(searchRoute, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ fitmentContractVersion: 2, query: 'fixture empty', results: [], fallbackResults: [], fitmentSummary: { verified: 0, fallback: 0, hiddenIrrelevantFallbacks: 0 }, providerErrors: {}, skippedProviders: [], cached: false }),
    })
  })
  await page.goto(`${app.baseUrl}/?year=2020&make=Toyota&model=Camry&trim=LE&part=Brake+Pads`)
  await expect(page.getByText('No listings found')).toBeVisible()
  await page.unroute(searchRoute)

  let errorHits = 0
  await page.route(searchRoute, async (route) => {
    errorHits += 1
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Intentional fixture outage' }) })
  })
  await page.reload()
  await expect(page.getByText("We couldn't complete this search.")).toBeVisible()
  expect(errorHits).toBe(1)
  await page.unroute(searchRoute)
  await page.getByRole('button', { name: 'Try again' }).click()
  await expectResults(page)

  let slowHits = 0
  let releaseSlowSearch: (() => void) | undefined
  const slowSearchReleased = new Promise<void>((resolve) => { releaseSlowSearch = resolve })
  await page.route(searchRoute, async (route) => {
    slowHits += 1
    await slowSearchReleased
    await route.continue()
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('status').filter({ hasText: /Scanning live listings/ })).toBeVisible()
  releaseSlowSearch?.()
  await expectResults(page)
  expect(slowHits).toBe(1)
  await page.unroute(searchRoute)

  let offlineHits = 0
  await page.route(searchRoute, async (route) => {
    offlineHits += 1
    await route.abort('internetdisconnected')
  })
  await page.reload()
  await expect(page.getByText("We couldn't complete this search.")).toBeVisible()
  expect(offlineHits).toBe(1)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo, [
    /503|Service Unavailable/,
    /ERR_INTERNET_DISCONNECTED|NS_ERROR_OFFLINE|NetworkError|Failed to fetch/,
  ])
})

async function auditCoreJourney(
  page: Page,
  app: AppHarness,
  fixtureServer: FixtureHarness,
  testInfo: TestInfo,
  theme: 'light' | 'dark',
) {
  const a11y = createWcagAaCollector(testInfo)
  await page.goto(app.baseUrl, { waitUntil: 'domcontentloaded' })
  if (theme === 'dark') {
    await page.getByRole('button', { name: 'Toggle theme' }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
  }
  await expect(page.getByRole('combobox', { name: 'Make' })).toBeEnabled()
  await a11y.check(page, `${theme}-vehicle`)
  await chooseFixtureVehicle(page)
  await a11y.check(page, `${theme}-part`)

  await page.goto(app.baseUrl, { waitUntil: 'domcontentloaded' })
  await openWatchlist(page)
  await a11y.check(page, `${theme}-empty-watchlist`)

  await page.goto(app.baseUrl, { waitUntil: 'domcontentloaded' })
  await openGuestAccount(page)
  await a11y.check(page, `${theme}-guest-account`)

  await goToResults(page, app.baseUrl)
  await a11y.check(page, `${theme}-results`)
  if (await page.evaluate(() => window.innerWidth < 640)) {
    await page.getByRole('button', { name: 'Filters' }).click()
    await expect(page.getByRole('dialog', { name: 'Filter listings' })).toBeVisible()
    await a11y.check(page, `${theme}-filters`)
    await page.getByRole('button', { name: 'Show results' }).click()
  }

  await openDetails(page)
  await a11y.check(page, `${theme}-details`)
  await page.getByRole('dialog', { name: /listing details/ }).getByLabel('Close').click()

  const cards = page.locator('.listing-card')
  await cards.nth(1).getByRole('button', { name: 'Compare' }).click()
  await cards.nth(0).getByRole('button', { name: 'Compare' }).click()
  await page.getByRole('button', { name: 'Compare Now' }).click()
  await expect(page.getByRole('dialog', { name: 'Compare listings' })).toBeVisible()
  await a11y.check(page, `${theme}-compare`)
  await page.keyboard.press('Escape')
  await expectNoHorizontalOverflow(page, 'comparison dialog')
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
  a11y.assertClean()
}

test('WCAG AA checks the light-mode core journey and dialogs', async ({ page, app, fixtureServer }, testInfo) => {
  await auditCoreJourney(page, app, fixtureServer, testInfo, 'light')
})

test('WCAG AA checks the dark-mode core journey and dialogs', async ({ page, app, fixtureServer }, testInfo) => {
  await auditCoreJourney(page, app, fixtureServer, testInfo, 'dark')
})

test('reflows 200% text at 320px and honors reduced motion', async ({ page, app, fixtureServer }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await goToResults(page, app.baseUrl)
  await page.addStyleTag({ content: 'html { font-size: 200%; }' })
  await expectNoHorizontalOverflow(page, '200% text at 320px')
  // Clipping can make a root-overflow assertion pass while nested padding
  // leaves one-character text columns. Preserve actual reading/input space.
  const headingBox = await page.getByRole('heading', { level: 1, name: 'Brake Pads' }).boundingBox()
  const emailBox = await page.getByRole('textbox', { name: 'Email address' }).boundingBox()
  expect(headingBox?.width).toBeGreaterThanOrEqual(180)
  expect(emailBox?.width).toBeGreaterThanOrEqual(160)
  expect(await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
  const reducedMotion = await page.locator('.listing-card').first().evaluate((element) => {
    const styles = getComputedStyle(element)
    return {
      durationSeconds: Number.parseFloat(styles.animationDuration),
      iterations: styles.animationIterationCount,
    }
  })
  expect(reducedMotion.durationSeconds).toBeLessThanOrEqual(0.01)
  expect(reducedMotion.iterations).toBe('1')
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})
