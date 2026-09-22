import { expect } from '@playwright/test'
import { test, assertNoUnexpectedRuntimeErrors } from './helpers/fixture'
import { createWcagAaCollector } from './helpers/a11y'
import { chooseCombobox, goToResults, openDetails } from './helpers/journey'

const recallRoute = /\/api\/recalls(?:\?|$)/
const guideRoute = '**/api/ai/repair-guide'
const recall = { campaignNumber: 'FIXTURE-001', component: 'Fixture component', summary: 'Fixture recall notice for testing only.', consequence: null, remedy: 'Contact the vehicle manufacturer.', reportedDate: '2026-01-01' }
const guide = '## Safety first\n\nConsult the manufacturer service manual.\n\n## Preparation\n\n- Confirm the exact part number.\n\n[Untrusted link](https://example.invalid/)\n\n<img src=x onerror="alert(1)">'

test('invalid recall cache and failed responses recover without claiming the vehicle is recall-free', async ({ page, app, fixtureServer }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem('carpartsradar-garage', JSON.stringify([{ year: '2020', make: 'Toyota', model: 'Camry', trim: 'LE' }]))
    sessionStorage.setItem('cpf-recalls-2020|toyota|camry', JSON.stringify({ invalid: true }))
  })
  let requests = 0
  await page.route(recallRoute, async route => {
    requests += 1
    if (requests === 1) await route.fulfill({ status: 503, json: { error: 'Intentional recall outage' } })
    else if (requests === 2) await route.fulfill({ json: { recalls: [{ component: { invalid: true } }] } })
    else await route.fulfill({ json: { recalls: [] } })
  })
  await page.goto(app.baseUrl)
  await page.getByRole('button', { name: 'Vehicle health for 2020 Toyota Camry' }).click()
  const dialog = page.getByRole('dialog', { name: /vehicle health/ })
  await expect(dialog.getByRole('alert')).toContainText("Couldn't load recall notices")
  await dialog.getByRole('button', { name: 'Retry recall lookup' }).click()
  await expect.poll(() => requests).toBe(2)
  await expect(dialog.getByRole('alert')).toContainText("Couldn't load recall notices")
  await dialog.getByRole('button', { name: 'Retry recall lookup' }).click()
  await expect(dialog.getByText(/No recall notices were returned/)).toBeVisible()
  await expect(dialog.getByRole('link', { name: /Check your VIN/ })).toHaveAttribute('href', 'https://www.nhtsa.gov/recalls')
  await expect(dialog.getByText(/No open recalls|recall.free/i)).toHaveCount(0)
  expect(requests).toBe(3)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo, [/503|Service Unavailable/])
})

test('repair guide timeout and cancellation leave a usable recovery path', async ({ page, app, fixtureServer }, testInfo) => {
  await page.clock.install()
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  let requests = 0
  let aborted = 0
  page.on('requestfailed', request => { if (request.url().endsWith('/api/ai/repair-guide')) aborted += 1 })
  await page.route(guideRoute, async route => {
    requests += 1
    await held
    await route.fulfill({ json: { guide } })
  })
  try {
    await goToResults(page, app.baseUrl)
    await openDetails(page)
    await page.getByRole('button', { name: 'Generate AI Guide' }).click()
    const dialog = page.getByRole('dialog', { name: 'AI Repair Guide for Brake Pads' })
    await expect(dialog.getByRole('status')).toContainText('writing your repair guide')
    await page.clock.fastForward(46_000)
    await expect(dialog.getByRole('alert')).toContainText('timed out')
    await dialog.getByRole('button', { name: 'Retry' }).click()
    await expect.poll(() => requests).toBe(2)
    await dialog.getByLabel('Close', { exact: true }).click()
    await expect(page.getByRole('dialog', { name: /listing details/ })).toBeVisible()
    await expect.poll(() => aborted).toBe(2)
  } finally {
    release()
  }
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

for (const theme of ['light', 'dark'] as const) {
  test(`vehicle health validates mileage and presents recall notices in ${theme} mode`, async ({ page, app, fixtureServer }, testInfo) => {
    const a11y = createWcagAaCollector(testInfo)
    await page.route(recallRoute, route => route.fulfill({ json: { recalls: [recall] } }))
    await page.goto(app.baseUrl)
    if (theme === 'dark') await page.getByRole('button', { name: 'Toggle theme' }).click()
    await chooseCombobox(page, 'Year', '2020')
    await chooseCombobox(page, 'Make', 'Toyota')
    await chooseCombobox(page, 'Model', 'Camry')
    await page.getByRole('button', { name: 'LE', exact: true }).click()
    await page.getByRole('button', { name: 'Save to Garage' }).click()
    // Exercise keyboard focus restoration explicitly. Safari intentionally
    // does not focus buttons on an ordinary pointer click.
    const opener = page.getByRole('button', { name: 'Vehicle health for 2020 Toyota Camry' })
    await opener.focus()
    await opener.press('Enter')
    const dialog = page.getByRole('dialog', { name: /vehicle health/ })
    await expect(dialog.getByText(recall.summary)).toBeVisible()
    await expect(page.locator('#root')).toHaveJSProperty('inert', true)
    await a11y.check(page, `${theme}-recall-notice`)
    if (testInfo.project.name.startsWith('chromium-')) {
      await page.screenshot({ path: testInfo.outputPath(`${theme}-recall-notice.png`) })
    }
    const mileage = dialog.getByRole('textbox', { name: 'Mileage' })
    await mileage.fill('-4')
    await mileage.press('Tab')
    await expect(mileage).toHaveAttribute('aria-invalid', 'true')
    await expect(dialog.getByRole('alert')).toContainText('whole number')
    await mileage.fill('84000')
    await mileage.press('Tab')
    await expect(mileage).toHaveAttribute('aria-invalid', 'false')
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(page.locator('#root')).toHaveJSProperty('inert', false)
    await expect(page.getByRole('button', { name: 'Vehicle health for 2020 Toyota Camry' })).toBeFocused()
    await page.reload()
    await page.getByRole('button', { name: 'Vehicle health for 2020 Toyota Camry' }).click()
    await expect(page.getByRole('textbox', { name: 'Mileage' })).toHaveValue('84000')
    assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
    a11y.assertClean()
  })

  test(`repair guide recovers from failure and safely renders content in ${theme} mode`, async ({ page, app, fixtureServer }, testInfo) => {
    const a11y = createWcagAaCollector(testInfo)
    let requests = 0
    await page.route(guideRoute, async route => {
      requests += 1
      expect(route.request().postDataJSON()).toMatchObject({ year: '2020', make: 'Toyota', model: 'Camry', part: 'Brake Pads', fitmentProof: 'Fixture exact YMM evidence' })
      await route.fulfill(requests === 1
        ? { status: 503, json: { error: 'Intentional guide outage' } }
        : { json: { guide } })
    })
    await goToResults(page, app.baseUrl)
    if (theme === 'dark') await page.getByRole('button', { name: 'Toggle theme' }).click()
    await openDetails(page)
    await page.getByRole('button', { name: 'Generate AI Guide' }).click()
    const dialog = page.getByRole('dialog', { name: 'AI Repair Guide for Brake Pads' })
    await expect(dialog.getByRole('alert')).toContainText('Failed to generate guide')
    await a11y.check(page, `${theme}-guide-error`)
    await dialog.getByRole('button', { name: 'Retry' }).click()
    await expect(dialog.getByRole('heading', { name: 'Safety first' })).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'Safety first' })).toHaveCSS('font-weight', '700')
    await expect(dialog.getByRole('list')).toHaveCSS('list-style-type', 'disc')
    await expect(dialog.getByRole('link')).toHaveCount(0)
    await expect(dialog.locator('img, script, iframe')).toHaveCount(0)
    await a11y.check(page, `${theme}-guide-success`)
    if (testInfo.project.name.startsWith('chromium-')) {
      await page.screenshot({ path: testInfo.outputPath(`${theme}-guide-success.png`) })
    }
    expect(requests).toBe(2)
    await dialog.getByRole('button', { name: 'Close Guide' }).click()
    await expect(page.getByRole('dialog', { name: /listing details/ })).toBeVisible()
    assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo, [/503|Service Unavailable/])
    a11y.assertClean()
  })
}
