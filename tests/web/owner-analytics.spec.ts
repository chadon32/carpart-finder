import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'
import { test, assertNoUnexpectedRuntimeErrors } from './helpers/fixture'
import type { WebsiteAnalytics } from '../../src/api/ownerAnalytics'

function reportFor(days = 30, empty = false): WebsiteAnalytics {
  const end = Date.parse('2026-10-05T12:00:00Z')
  const count = empty ? 0 : days
  const daily = Array.from({ length: days }, (_, index) => ({
    day: new Date(end - (days - index - 1) * 86400000).toISOString().slice(0, 10),
    visitors: index === days - 1 ? count : 0,
    visits: index === days - 1 ? count : 0,
    pageviews: index === days - 1 ? count * 2 : 0,
    searches: index === days - 1 ? Math.floor(count / 2) : 0,
    clicks: index === days - 1 ? Math.floor(count / 5) : 0,
  }))
  return {
    version: 1,
    days,
    timezone: 'America/Phoenix',
    startDate: daily[0].day,
    endDate: daily.at(-1)!.day,
    firstTrackedAt: empty ? null : '2026-10-05T12:00:00Z',
    totals: {
      dailyVisitors: count,
      visits: count,
      pageviews: count * 2,
      searches: Math.floor(count / 2),
      retailerClicks: Math.floor(count / 5),
      engagedVisits: Math.floor(count / 2),
      storeClickVisits: Math.floor(count / 10),
      emptySearches: empty ? 0 : 2,
      failedSearches: empty ? 0 : 1,
    },
    funnel: [
      'Visited the website',
      'Selected a vehicle',
      'Started a part search',
      'Reached search results',
      'Opened or saved a listing',
      'Clicked through to a store',
    ].map((label, rank) => ({
      rank,
      label,
      count: Math.floor(count * [1, 0.7, 0.5, 0.4, 0.2, 0.1][rank]),
    })),
    daily,
    devices: empty ? [] : [{ key: 'phone', count }],
    sources: empty ? [] : [{ key: 'search', count }],
    retailers: empty ? [] : [{ key: 'ebay', count: Math.floor(count / 5) }],
    pages: empty ? [] : [{ key: 'home', count: count * 2 }],
    actions: [],
  }
}

async function ownerFixture(
  page: Page,
  { signedIn = true, empty = false, configured = true, unavailable = false } = {},
) {
  let authenticated = signedIn
  let outage = unavailable
  const reads: string[] = []
  await page.route('**/api/admin/**', async (route) => {
    const url = new URL(route.request().url())
    let status = 200
    let body: unknown
    if (url.pathname.endsWith('/session')) body = { authenticated, configured }
    else if (url.pathname.endsWith('/login')) {
      const input = route.request().postDataJSON()
      if (input.email === 'owner@example.test' && input.password === 'fixture-owner-password') {
        authenticated = true
        body = { authenticated }
      } else {
        status = 401
        body = { error: 'Invalid owner email or password.' }
      }
    } else if (url.pathname.endsWith('/logout')) {
      authenticated = false
      body = { authenticated }
    } else {
      reads.push(url.searchParams.get('days') || '30')
      status = outage ? 503 : authenticated ? 200 : 401
      body =
        status === 200
          ? reportFor(Number(url.searchParams.get('days') || 30), empty)
          : {
              error:
                status === 503 ? 'Analytics storage is not ready.' : 'Owner sign-in is required.',
            }
    }
    await route.fulfill({ status, json: body })
  })
  return {
    reads,
    recover: () => {
      outage = false
    },
  }
}

test('the owner dashboard displays counts, a deduplicated journey, and accessible daily numbers', async ({
  page,
  app,
  fixtureServer,
}, testInfo) => {
  await ownerFixture(page)
  await page.goto(`${app.baseUrl}/admin`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Website analytics', exact: true })).toBeVisible()
  await expect(
    page.locator('.owner-metric').filter({ hasText: 'Visits' }).locator('strong'),
  ).toHaveText('30')
  await expect(page.locator('.owner-funnel li')).toHaveCount(6)
  await expect(page.getByText('10.0% reached a store')).toBeVisible()
  await page.getByText('View daily numbers', { exact: true }).click()
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(30)
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.getByText('View daily numbers', { exact: true }).click()
  // Full-page screenshots otherwise preserve the sticky sidebar's scrolled position.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.screenshot({
    path: `artifacts/benchmarks/e2e/owner-dashboard-${testInfo.project.name}.png`,
    fullPage: true,
  })
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})
test('owner login and logout are separate from public customer accounts', async ({
  page,
  app,
  fixtureServer,
}, testInfo) => {
  const fixture = await ownerFixture(page, { signedIn: false })
  await page.goto(`${app.baseUrl}/admin`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'Sign in to analytics' })).toBeVisible()
  expect(fixture.reads).toEqual([])
  await page.getByLabel('Owner email').fill('owner@example.test')
  await page.getByLabel('Password', { exact: true }).fill('fixture-owner-password')
  await page.getByRole('button', { name: 'Sign in to analytics' }).click()
  await expect(page.locator('.owner-metric')).toHaveCount(4)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sign in to analytics' })).toBeVisible()
  await expect(page.locator('.owner-metric')).toHaveCount(0)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})
test('date ranges and refresh update every number from the protected backend', async ({
  page,
  app,
  fixtureServer,
}, testInfo) => {
  const fixture = await ownerFixture(page)
  await page.goto(`${app.baseUrl}/admin`, { waitUntil: 'domcontentloaded' })
  const metric = page
    .locator('.owner-metric')
    .filter({ hasText: 'Daily unique visitors' })
    .locator('strong')
  await expect(metric).toHaveText('30')
  await page.getByLabel('Date range').selectOption('7')
  await expect(metric).toHaveText('7')
  await page.getByLabel('Date range').selectOption('90')
  await expect(metric).toHaveText('90')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(metric).toHaveText('90')
  expect(fixture.reads).toContain('7')
  expect(fixture.reads.filter((day) => day === '90').length).toBeGreaterThanOrEqual(2)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})
test('a genuinely empty report shows zero counts and no invented conversion rates', async ({
  page,
  app,
  fixtureServer,
}, testInfo) => {
  await ownerFixture(page, { empty: true })
  await page.goto(`${app.baseUrl}/admin`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('No visits recorded in this range yet.')).toBeVisible()
  await expect(page.locator('.owner-metric > strong')).toHaveText(['0', '0', '0', '0'])
  await expect(page.getByText('— engaged', { exact: true })).toBeVisible()
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})
test('storage failures are not confused with zero traffic and Refresh can recover', async ({
  page,
  app,
  fixtureServer,
}, testInfo) => {
  const fixture = await ownerFixture(page, { unavailable: true })
  await page.goto(`${app.baseUrl}/admin`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('alert')).toContainText('Analytics unavailable')
  await expect(page.locator('.owner-metric')).toHaveCount(0)
  fixture.recover()
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.locator('.owner-metric')).toHaveCount(4)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo, [/Failed to load resource.*503/])
})
test('missing owner setup disables login without displaying any credentials', async ({
  page,
  app,
  fixtureServer,
}, testInfo) => {
  await ownerFixture(page, { signedIn: false, configured: false })
  await page.goto(`${app.baseUrl}/admin`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('status')).toContainText('Owner access needs server setup')
  await expect(page.getByRole('button', { name: 'Sign in to analytics' })).toBeDisabled()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('opening the private owner workspace never records a public visit', async ({
  page,
  app,
  fixtureServer,
}, testInfo) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'webdriver', { get: () => false }),
  )
  const recorded: string[] = []
  await page.route('**/api/analytics/events', async (route) => {
    recorded.push(route.request().url())
    await route.fulfill({ status: 204 })
  })
  await ownerFixture(page)
  await page.goto(`${app.baseUrl}/admin`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.owner-metric')).toHaveCount(4)
  await page.getByLabel('Date range').selectOption('7')
  await expect(page.locator('.owner-metric').first().locator('strong')).toHaveText('7')
  expect(recorded).toEqual([])
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})
