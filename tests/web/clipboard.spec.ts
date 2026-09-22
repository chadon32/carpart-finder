import { expect } from '@playwright/test'
import { test, assertNoUnexpectedRuntimeErrors } from './helpers/fixture'
import { goToResults } from './helpers/journey'

test('rapid taps share one pending clipboard operation', async ({ page, app, fixtureServer }, testInfo) => {
  await page.addInitScript(() => {
    const target = window as Window & { __copyCalls?: number; __finishCopy?: () => void }
    target.__copyCalls = 0
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () => {
          target.__copyCalls! += 1
          return new Promise<void>((resolve) => { target.__finishCopy = resolve })
        },
      },
    })
  })
  await goToResults(page, app.baseUrl)
  const copyButton = page.getByRole('button', { name: 'Copy share link' })
  await copyButton.click({ clickCount: 3 })
  expect(await page.evaluate(() => (window as Window & { __copyCalls?: number }).__copyCalls)).toBe(1)
  await expect(copyButton).not.toContainText('Copied!')
  await page.evaluate(() => (window as Window & { __finishCopy?: () => void }).__finishCopy?.())
  await expect(copyButton).toContainText('Copied!')
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('copies the current results URL when clipboard access succeeds', async ({ page, app, fixtureServer }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (value: string) => {
          const target = window as Window & { __copiedShareLinks?: string[] }
          target.__copiedShareLinks ??= []
          target.__copiedShareLinks.push(value)
          return Promise.resolve()
        },
      },
    })
  })

  await goToResults(page, app.baseUrl)
  const copyButton = page.getByRole('button', { name: 'Copy share link' })
  await copyButton.click()
  await expect(copyButton).toContainText('Copied!')
  expect(await page.evaluate(() => (window as Window & { __copiedShareLinks?: string[] }).__copiedShareLinks)).toEqual([page.url()])
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})

test('reports clipboard denial without falsely reporting a successful copy', async ({ page, app, fixtureServer }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () => Promise.reject(new DOMException('Clipboard permission denied', 'NotAllowedError')),
      },
    })
  })

  await goToResults(page, app.baseUrl)
  const copyButton = page.getByRole('button', { name: 'Copy share link' })
  await copyButton.click()
  await expect(page.getByText('Couldn’t copy the link. Copy the address from your browser’s address bar instead.')).toBeVisible()
  await expect(copyButton).not.toContainText('Copied!')
  assertNoUnexpectedRuntimeErrors(app, fixtureServer, testInfo)
})
