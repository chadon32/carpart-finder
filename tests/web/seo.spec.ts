import AxeBuilder from '@axe-core/playwright'
import { expect } from '@playwright/test'
import { test, assertNoUnexpectedRuntimeErrors } from './helpers/fixture'
import { expectNoHorizontalOverflow, expectResults } from './helpers/journey'

test('search metadata stays unique and returns to an indexable homepage', async ({ page, app, fixtureServer }, testInfo) => {
  await page.goto(`${app.baseUrl}/?year=2020&make=Toyota&model=Camry&trim=LE&part=Brake+Pads`)
  await expectResults(page)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow')
  await expect(page.locator('meta[name="description"]')).toHaveCount(1)
  await expect(page.locator('meta[property="og:title"]')).toHaveCount(1)
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0)
  await expect(page).toHaveTitle(/Brake Pads.*Compare Prices/)
  const schemas = await page.locator('script[type="application/ld+json"]').allTextContents()
  expect(schemas.join('')).not.toContain('AggregateOffer')

  await page.getByRole('button', { name: /^CarPartsRadar(?: Live price comparison)?$/i }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Find the right part.')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow')
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://carpartsradar.com/')
  await expect(page.locator('meta[name="description"]')).toHaveCount(1)
  await expectNoHorizontalOverflow(page, 'SEO homepage links')
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('guide jump links and comparison CTA are accessible and usable', async ({ page, app, fixtureServer }, testInfo) => {
  await page.goto(`${app.baseUrl}/guides/compare-total-car-part-cost.html`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('How to Compare the Real Cost of an Online Car Part')
  expect(await page.getByRole('heading', { level: 1 }).evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeLessThanOrEqual(68)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://carpartsradar.com/guides/compare-total-car-part-cost.html')
  await expectNoHorizontalOverflow(page, 'buying guide')
  const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(a11y.violations).toEqual([])
  const jump = page.getByRole('navigation', { name: 'In this guide' }).getByRole('link', { name: 'Before you order', exact: true })
  await jump.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#before-you-order$/)
  await expect(page.locator('#before-you-order')).toBeInViewport()
  await page.getByRole('link', { name: /Choose your vehicle and compare parts/ }).click()
  await expect(page).toHaveURL(/\?guide=compare-total-car-part-cost$/)
  await expect(page.getByRole('combobox', { name: 'Make', exact: true })).toBeEnabled()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://carpartsradar.com/')
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})
