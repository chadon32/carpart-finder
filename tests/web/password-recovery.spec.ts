import { expect } from '@playwright/test'
import { test, assertNoUnexpectedRuntimeErrors } from './helpers/fixture'
import { openGuestAccount } from './helpers/journey'

// A forgotten password used to be a dead end: the sign-in screen had no way
// to recover it.

const expectedErrors = [/Failed to load resource/i, /401|403/]

test('the sign-in screen offers a reset link without revealing whether an account exists', async ({ page, app, fixtureServer }, testInfo) => {
  let requested: string | null = null
  await page.route(/\/api\/supabase\/password\/forgot/, async (route) => {
    requested = (route.request().postDataJSON() as { email: string }).email
    await route.fulfill({ json: { success: true } })
  })
  await page.goto(app.baseUrl, { waitUntil: 'domcontentloaded' })
  await openGuestAccount(page)

  await page.getByLabel('Email').fill('driver@example.com')
  await page.getByRole('button', { name: 'Forgot password?' }).click()
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible()
  await expect(page.getByLabel('Email')).toHaveValue('driver@example.com')

  await page.getByLabel('Email').fill('not-an-email')
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Enter a valid email address.' })).toBeVisible()
  expect(requested).toBeNull()

  await page.getByLabel('Email').fill('driver@example.com')
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByRole('status').filter({ hasText: /If an account exists for that email/ })).toBeVisible()
  expect(requested).toBe('driver@example.com')

  await page.getByRole('button', { name: 'Back to sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo, expectedErrors)
})

test('the link in the email opens a form that sets a new password and signs the person in', async ({ page, app, fixtureServer }, testInfo) => {
  let sent: { access_token: string; password: string } | null = null
  await page.route(/\/api\/supabase\/password\/reset/, async (route) => {
    sent = route.request().postDataJSON() as { access_token: string; password: string }
    await route.fulfill({ json: { user: { email: 'driver@example.com', user_metadata: { full_name: 'Driver' } } } })
  })
  await page.route(/\/api\/supabase\/(saved-searches|price-alerts)/, (route) => route.fulfill({ json: { searches: [], alerts: [] } }))
  // Not a session: the token must never be sent to set-session or kept in the address bar.
  let sessionStarted = false
  await page.route(/\/api\/supabase\/set-session/, (route) => { sessionStarted = true; return route.fulfill({ status: 400, json: {} }) })

  await page.goto(`${app.baseUrl}/#access_token=recovery-token-123&refresh_token=r&type=recovery`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible()
  expect(page.url()).not.toContain('recovery-token-123')
  expect(sessionStarted).toBe(false)

  await page.getByLabel('New password', { exact: true }).fill('short')
  await page.getByLabel('Confirm new password').fill('short')
  await page.getByRole('button', { name: 'Set new password' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Use at least 8 characters.' })).toBeVisible()

  await page.getByLabel('New password', { exact: true }).fill('brand-new-password')
  await page.getByLabel('Confirm new password').fill('different-password')
  await page.getByRole('button', { name: 'Set new password' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'The two passwords do not match.' })).toBeVisible()
  expect(sent).toBeNull()

  await page.getByLabel('Confirm new password').fill('brand-new-password')
  await page.getByRole('button', { name: 'Set new password' }).click()
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeHidden()
  expect(sent).toEqual({ access_token: 'recovery-token-123', password: 'brand-new-password' })
  await expect(page.getByText('Password updated. You are signed in.')).toBeVisible()
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo, expectedErrors)
})

test('an expired reset link says so and offers a new one', async ({ page, app, fixtureServer }, testInfo) => {
  await page.route(/\/api\/supabase\/password\/reset/, (route) => route.fulfill({ status: 401, json: { error: 'This reset link has expired. Request a new link and try again.' } }))
  await page.goto(`${app.baseUrl}/#access_token=old-token&type=recovery`, { waitUntil: 'domcontentloaded' })
  await page.getByLabel('New password', { exact: true }).fill('brand-new-password')
  await page.getByLabel('Confirm new password').fill('brand-new-password')
  await page.getByRole('button', { name: 'Set new password' }).click()

  const alert = page.getByRole('alert').filter({ hasText: /reset link has expired/ })
  await expect(alert).toBeVisible()
  await alert.getByRole('button', { name: 'Request a new link' }).click()
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible()
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo, expectedErrors)
})
