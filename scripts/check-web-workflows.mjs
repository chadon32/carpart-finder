import assert from 'node:assert/strict'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
import { startFixtureServer } from './benchmark-web-lib.mjs'

// Exercise the built UI, not component implementation details. All API data
// comes from the same loopback-only fixtures as the performance benchmark.
const root = path.resolve(import.meta.dirname, '..')
const chrome = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(existsSync)
assert.ok(chrome, 'Chrome not found; set CHROME_PATH')
const profiles = {
  desktop: { width: 1365, height: 768 },
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true },
  tablet: { width: 834, height: 1112, isMobile: true, hasTouch: true },
}

async function clickButton(page, name) {
  const buttons = await page.$$('button')
  for (const button of buttons) {
    const text = await button.evaluate((element) => (element.getAttribute('aria-label') || element.textContent).trim())
    if (text === name && await button.boundingBox()) {
      await button.click()
      return
    }
  }
  throw new Error(`Visible button not found: ${name}`)
}

async function fillCombo(page, name, value) {
  const selector = `[role="combobox"][aria-label="${name}"]`
  await page.waitForSelector(`${selector}:not(:disabled)`)
  await page.click(selector)
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
  await page.keyboard.down(modifier)
  await page.keyboard.press('A')
  await page.keyboard.up(modifier)
  await page.keyboard.press('Backspace')
  await page.keyboard.type(value)
}

async function chooseCombo(page, name, value) {
  await fillCombo(page, name, value)
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  assert.equal(await page.$eval(`[role="combobox"][aria-label="${name}"]`, (input) => input.value), value)
}

async function assertFits(page, context) {
  const dimensions = await page.evaluate(() => ({ width: innerWidth, contentWidth: document.documentElement.scrollWidth }))
  assert.ok(dimensions.contentWidth <= dimensions.width + 1, `${context}: horizontal overflow ${JSON.stringify(dimensions)}`)
}

const fixture = await startFixtureServer(path.join(root, 'dist'))
const screenshotDir = path.join(root, 'benchmark-shots', 'workflows')
mkdirSync(screenshotDir, { recursive: true })
let browser
try {
  browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--disable-background-networking', '--disable-extensions', '--no-first-run'] })
  for (const [profile, viewport] of Object.entries(profiles)) {
    const context = await browser.createBrowserContext()
    try {
      const page = await context.newPage()
      await page.setViewport(viewport)
      await page.setBypassServiceWorker(true)
      const errors = []
      const scripts = new Set()
      const heldRoutes = []
      let holdResultsRoute = true
      await page.setRequestInterception(true)
      page.on('request', (request) => {
        const url = request.url()
        if (/^(data:|blob:|about:)/.test(url)) return request.continue()
        if (new URL(url).origin !== fixture.url) return request.abort('blockedbyclient')
        if (url.endsWith('.js')) scripts.add(url)
        if (holdResultsRoute && /\/ResultsList-[^/]+\.js$/.test(url)) {
          heldRoutes.push(request)
          return
        }
        return request.continue()
      })
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('console', (message) => {
        if (message.type() === 'error' && (!message.location().url || message.location().url.startsWith(fixture.url))) errors.push(message.text())
      })
      page.on('response', (response) => {
        if (response.url().startsWith(fixture.url) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`)
      })
      await page.goto(`${fixture.url}/?year=2020&make=Toyota&model=Camry&trim=LE&part=Brake+Pads`, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('[role="status"][aria-label="Loading"]')
      assert.ok(await page.$eval('footer', (footer) => footer.getBoundingClientRect().top >= innerHeight), 'Loading route must reserve content space instead of flashing the footer')
      holdResultsRoute = false
      for (const request of heldRoutes) await request.continue()
      await page.waitForFunction(() => document.querySelectorAll('.listing-card').length === 2)
      await page.goto(fixture.url, { waitUntil: 'networkidle0' })
      await page.waitForSelector('[role="combobox"][aria-label="Make"]:not(:disabled)')
      assert.deepEqual(await page.$$eval('[role="combobox"]', (inputs) => inputs.map((input) => input.getAttribute('aria-label'))), ['Year', 'Make', 'Model'])
      const labelLinks = await page.$$eval('[role="combobox"]', (inputs) => inputs.every((input) => input.labels.length === 1))
      assert.ok(labelLinks, 'Visible vehicle labels must be linked to their inputs')
      assert.ok(await page.$eval('input[placeholder^="e.g. LE"]', (input) => input.labels.length === 1), 'Free-text trim needs a linked label')
      await assertFits(page, `${profile} vehicle selector`)

      await fillCombo(page, 'Year', 'P0302')
      assert.equal(await page.$$eval('[role="option"]', (items) => items.length), 0, 'A diagnostic code must not offer part names in the Year field')
      await fillCombo(page, 'Year', '')
      await page.keyboard.press('ArrowUp')
      assert.equal(await page.$eval('[role="combobox"][aria-label="Year"]', (input) => document.getElementById(input.getAttribute('aria-activedescendant')).textContent.trim()), '1980', 'ArrowUp should start at the final option')
      await page.keyboard.press('Escape')
      assert.equal(await page.$eval('[role="combobox"][aria-label="Year"]', (input) => input.getAttribute('aria-activedescendant')), null, 'Closed combobox must not reference an unmounted option')

      await chooseCombo(page, 'Year', '2020')
      await chooseCombo(page, 'Make', 'Toyota')
      await chooseCombo(page, 'Model', 'Camry')
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some((button) => button.textContent.trim() === 'LE'))
      await clickButton(page, 'LE')
      await clickButton(page, 'Continue to parts')
      await page.waitForSelector('[role="combobox"][aria-label="Part search"]')
      await fillCombo(page, 'Part search', '')
      await page.keyboard.press('Enter')
      await page.waitForSelector('[role="combobox"][aria-invalid="true"]')
      assert.ok(await page.$('[role="alert"]'), 'Blank part search must explain how to recover')
      await fillCombo(page, 'Part search', 'Brake Pads')
      await page.keyboard.press('Enter')
      await page.waitForFunction(() => document.querySelectorAll('.listing-card').length === 2)
      assert.equal([...scripts].some((url) => /\/(?:FilterSheet|Modal)-[^/]+\.js$/.test(url)), false, 'Dialog code should not load until requested')
      assert.equal(await page.evaluate(() => window.scrollY), 0, 'A new search must start at the top of the results')
      await assertFits(page, `${profile} results`)
      assert.ok(await page.$$eval('.listing-card h3', (titles) => titles.every((title) => title.getBoundingClientRect().height <= parseFloat(getComputedStyle(title).lineHeight) * 4 + 1)), 'Listing titles must not collapse into one-character columns')
      await page.waitForFunction(() => document.getAnimations().filter((animation) => animation.effect?.getTiming().iterations !== Infinity).every((animation) => animation.playState === 'finished'))
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      await page.screenshot({ path: path.join(screenshotDir, `${profile}-results.png`), fullPage: true })

      if (profile === 'mobile') {
        await clickButton(page, 'Filters')
        await page.waitForSelector('[role="dialog"]', { visible: true })
        await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement))
        assert.ok([...scripts].some((url) => /\/FilterSheet-[^/]+\.js$/.test(url)), 'Filter dialog should load on demand')
        await page.keyboard.press('Tab')
        assert.ok(await page.$eval('[role="dialog"]', (dialog) => dialog.contains(document.activeElement)), 'Keyboard focus must stay in the dialog')
        await page.waitForFunction(() => document.getAnimations().filter((animation) => animation.effect?.getTiming().iterations !== Infinity).every((animation) => animation.playState === 'finished'))
        await page.screenshot({ path: path.join(screenshotDir, 'mobile-filters.png') })
        await clickButton(page, 'Show results')
        await page.waitForSelector('[role="dialog"]', { hidden: true })
        await page.waitForFunction(() => document.activeElement?.textContent.trim() === 'Filters')
      }
      await page.reload({ waitUntil: 'networkidle0' })
      await page.waitForFunction(() => document.querySelectorAll('.listing-card').length === 2)
      assert.deepEqual(errors, [], `${profile}: runtime or local request errors`)
      console.log(`PASS ${profile}: labels, invalid input, keyboard navigation, vehicle → part → results, deferred dialog, layout, refresh${profile === 'mobile' ? ', filter sheet/focus' : ''}`)
    } finally {
      await context.close()
    }
  }
  assert.deepEqual(fixture.unexpectedRequests, [], 'Fixture requests must stay within the supported workflows')
  console.log(`Screenshots: ${screenshotDir}`)
} finally {
  try { await browser?.close() } finally { await fixture.close() }
}
