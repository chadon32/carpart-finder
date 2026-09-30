import { expect } from '@playwright/test'
import { test, assertNoUnexpectedRuntimeErrors } from './helpers/fixture'
import { goToResults } from './helpers/journey'

test('a skip link is the first stop and moves focus to the content', async ({ page, app, fixtureServer, browserName }, testInfo) => {
  await page.goto(app.baseUrl, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('combobox', { name: 'Make', exact: true })).toBeEnabled()
  const skip = page.getByRole('link', { name: 'Skip to content' })

  // In every browser: nothing focusable comes before it in the page.
  const firstFocusable = await page.evaluate(() =>
    document.querySelector('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')?.textContent?.trim())
  expect(firstFocusable).toBe('Skip to content')

  if (browserName === 'webkit') {
    // WebKit leaves links out of the Tab order unless the user opts in, so a
    // real Tab press would skip past it. Focus it directly instead.
    await skip.focus()
  } else {
    await page.keyboard.press('Tab')
  }
  await expect(skip).toBeFocused()
  await expect(skip).toBeInViewport()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main-content')).toBeFocused()
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('the dark mode switch reports whether it is on', async ({ page, app, fixtureServer }, testInfo) => {
  await page.goto(app.baseUrl, { waitUntil: 'domcontentloaded' })
  const toggle = page.getByRole('button', { name: 'Dark mode' })
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('html')).toHaveClass(/dark/)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('the account button is named by what it shows', async ({ page, app, fixtureServer }, testInfo) => {
  test.skip((page.viewportSize()?.width ?? 0) < 640, 'Phones use the bottom tab bar instead of the header button')
  await page.goto(app.baseUrl, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'Account', exact: true })).toBeVisible()

  // Signed in, the button shows the first name, so the name must contain it.
  await page.route(/\/api\/supabase\/me(?:\?|$)/, (route) => route.fulfill({ json: {} }))
  await page.addInitScript(() => {
    localStorage.setItem('carpartsradar-user', JSON.stringify({ name: 'Chad Smith', email: 'chad@example.com' }))
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  const account = page.getByRole('button', { name: /Chad/ })
  await expect(account).toBeVisible()
  await expect(account).toHaveText(/Chad/)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('completed steps can be clicked to go back', async ({ page, app, fixtureServer }, testInfo) => {
  await goToResults(page, app.baseUrl)
  const progress = page.getByRole('navigation', { name: 'Search progress' })
  await expect(progress.getByRole('button', { name: 'Change vehicle' })).toBeVisible()
  await progress.getByRole('button', { name: 'Change part' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What part do you need?')
  // The current step is not a control.
  await expect(progress.getByRole('button', { name: 'Change part' })).toHaveCount(0)

  await progress.getByRole('button', { name: 'Change vehicle' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Compare car part prices for your vehicle.')
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})
