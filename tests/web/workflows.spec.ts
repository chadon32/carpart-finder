import { expect } from '@playwright/test'
import { test, assertNoUnexpectedRuntimeErrors } from './helpers/fixture'
import { chooseFixtureVehicle, expectNoHorizontalOverflow, expectResults, fillCombobox, searchFixturePart } from './helpers/journey'

test('keyboard vehicle-to-part journey preserves labels and browser history', async ({ page, app, fixtureServer }, testInfo) => {
  await page.goto(app.baseUrl, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('combobox', { name: 'Make' })).toBeEnabled()

  for (const name of ['Year', 'Make', 'Model']) {
    await expect(page.getByRole('combobox', { name })).toHaveAccessibleName(name)
  }
  await expect(page.getByLabel(/Have your VIN/)).toHaveAccessibleName(/Have your VIN/)
  await expectNoHorizontalOverflow(page, 'vehicle selector')

  await fillCombobox(page, 'Year', 'P0302')
  await expect(page.getByRole('option')).toHaveCount(0)
  await fillCombobox(page, 'Year', '')
  await page.keyboard.press('ArrowUp')
  await expect(page.getByRole('combobox', { name: 'Year' }).evaluate((input) => {
    const activeId = input.getAttribute('aria-activedescendant')
    return activeId ? document.getElementById(activeId)?.textContent?.trim() : null
  })).resolves.toBe('1980')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('combobox', { name: 'Year' })).not.toHaveAttribute('aria-activedescendant')

  await chooseFixtureVehicle(page)
  await fillCombobox(page, 'Part search', '')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('combobox', { name: 'Part search' })).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('alert')).toBeVisible()

  await searchFixturePart(page)
  await expectNoHorizontalOverflow(page, 'results')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expectResults(page)
  await page.goBack()
  await expect(page.getByRole('combobox', { name: 'Part search' })).toBeVisible()
  await page.goForward()
  await expectResults(page)
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})
