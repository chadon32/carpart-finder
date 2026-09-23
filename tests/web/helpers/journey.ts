import { expect, type Page } from '@playwright/test'

export const fixtureRoute = '?year=2020&make=Toyota&model=Camry&trim=LE&part=Brake+Pads'

export async function fillCombobox(page: Page, name: string, value: string) {
  const input = page.getByRole('combobox', { name })
  await expect(input).toBeEnabled()
  await input.click()
  await input.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  await input.press('Backspace')
  if (value) await input.type(value)
}

export async function chooseCombobox(page: Page, name: string, value: string) {
  await fillCombobox(page, name, value)
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('combobox', { name })).toHaveValue(value)
}

export async function chooseFixtureVehicle(page: Page) {
  await chooseCombobox(page, 'Year', '2020')
  await chooseCombobox(page, 'Make', 'Toyota')
  await chooseCombobox(page, 'Model', 'Camry')
  await page.getByRole('button', { name: 'LE', exact: true }).click()
  await page.getByRole('button', { name: 'Continue to parts' }).click()
  await expect(page.getByRole('combobox', { name: 'Part search' })).toBeVisible()
}

export async function searchFixturePart(page: Page) {
  await fillCombobox(page, 'Part search', 'Brake Pads')
  await page.keyboard.press('Enter')
  await expectResults(page)
}

export async function expectResults(page: Page) {
  await expect(page.locator('.listing-card')).toHaveCount(2)
}

export async function goToResults(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/${fixtureRoute}`, { waitUntil: 'domcontentloaded' })
  await expectResults(page)
}

export async function expectNoHorizontalOverflow(page: Page, label: string) {
  const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, content: document.documentElement.scrollWidth }))
  expect(dimensions.content, `${label}: horizontal overflow`).toBeLessThanOrEqual(dimensions.viewport + 1)
}

export async function openDetails(page: Page) {
  const card = page.locator('.listing-card').first()
  const desktopButton = card.getByRole('button', { name: 'Click for Detailed View' })
  const mobileButton = card.getByRole('button', { name: 'Details' })
  if (await desktopButton.isVisible()) await desktopButton.click()
  else await mobileButton.click()
  await expect(page.getByRole('dialog', { name: /listing details/ })).toBeVisible()
}

export async function openWatchlist(page: Page) {
  const desktopWatchlist = page.getByRole('button', { name: 'Open watchlist' })
  if (await desktopWatchlist.isVisible()) await desktopWatchlist.click()
  else await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: /Watchlist/ }).click()
  await expect(page.getByRole('heading', { name: /^Watchlist/ })).toBeVisible()
}

export async function openGuestAccount(page: Page) {
  const desktopAccount = page.getByRole('button', { name: 'Open account' })
  if (await desktopAccount.isVisible()) await desktopAccount.click()
  else await page.getByRole('button', { name: 'Account', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
}

export async function expectDesktopAppInert(page: Page, expected: boolean) {
  if (await page.evaluate(() => window.innerWidth >= 640)) {
    await expect(page.locator('#root')).toHaveJSProperty('inert', expected)
  }
}
