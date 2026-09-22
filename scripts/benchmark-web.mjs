import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import puppeteer from 'puppeteer-core'
import {
  SCHEMA_VERSION,
  FIXTURE_VEHICLE,
  absoluteBudgetReport,
  buildFingerprint,
  calculateCls,
  compareReports,
  startFixtureServer,
  initialAssetSizes,
  parseArgs,
  summarizeSamples,
} from './benchmark-web-lib.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const NETWORK = { latencyMs: 150, downloadBps: (1.6 * 1024 * 1024) / 8, uploadBps: (750 * 1024) / 8 }
const PROFILES = {
  desktop: { width: 1365, height: 768, deviceScaleFactor: 1 },
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  tablet: { width: 834, height: 1112, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
}
const SCENARIOS = ['home', 'results', 'results-slow']

function detectedChrome() {
  const candidates = process.platform === 'win32'
    ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      ]
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  return candidates.find(existsSync) || null
}

function round(value, digits = 2) {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

function roundSummary(summary) {
  return Object.fromEntries(Object.entries(summary).map(([metric, values]) => [metric, Object.fromEntries(Object.entries(values).map(([key, value]) => [key, round(value, metric === 'cumulativeLayoutShift' ? 4 : 2)]))]))
}

function gitMetadata() {
  try {
    const runGit = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    return { sha: runGit('rev-parse', 'HEAD'), dirty: runGit('status', '--porcelain') !== '' }
  } catch {
    return { sha: null, dirty: null }
  }
}

function browserMetadata(version) {
  const match = /(?:Chrome|HeadlessChrome)\/(\d+)/.exec(version)
  return { version, major: match?.[1] || null }
}

function scenarioUrl(baseUrl, scenario) {
  return scenario.startsWith('results')
    ? `${baseUrl}/?year=2020&make=Toyota&model=Camry&trim=LE&part=Brake+Pads${scenario === 'results-slow' ? '&benchmarkSlow=1' : ''}`
    : `${baseUrl}/`
}

function validateMetric(name, value) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid ${name}: expected a positive performance entry, received ${value}`)
}

async function measurePage(browser, { baseUrl, profile, scenario, screenshotPath }) {
  const context = await browser.createBrowserContext()
  let page
  try {
    page = await context.newPage()
    await page.setViewport(PROFILES[profile])
    await page.setCacheEnabled(false)
    await page.setBypassServiceWorker(true)
    const localOrigin = new URL(baseUrl).origin
    const consoleErrors = []
    const localFailures = []
    await page.setRequestInterception(true)
    page.on('request', (request) => {
      const requestUrl = request.url()
      if (requestUrl.startsWith('data:') || requestUrl.startsWith('blob:') || requestUrl.startsWith('about:')) return request.continue()
      try {
        if (new URL(requestUrl).origin !== localOrigin) return request.abort('blockedbyclient')
      } catch {
        return request.abort('blockedbyclient')
      }
      return request.continue()
    })
    page.on('console', (message) => {
      if (message.type() !== 'error') return
      const location = message.location().url
      if (!location || new URL(location, localOrigin).origin === localOrigin) consoleErrors.push(message.text())
    })
    page.on('pageerror', (error) => consoleErrors.push(error.message))
    page.on('response', (response) => {
      if (response.url().startsWith(localOrigin) && response.status() >= 400) localFailures.push(`${response.status()} ${response.url()}`)
    })
    page.on('requestfailed', (request) => {
      if (request.url().startsWith(localOrigin)) localFailures.push(`request failed ${request.url()}: ${request.failure()?.errorText || 'unknown error'}`)
    })
    await page.evaluateOnNewDocument(() => {
      window.__cpfBenchmark = { lcp: 0, lcpCandidates: [], shifts: [], longTaskCount: 0, longTaskDuration: 0 }
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__cpfBenchmark.lcp = entry.startTime
          window.__cpfBenchmark.lcpCandidates.push({
            timeMs: entry.startTime, renderTimeMs: entry.renderTime, loadTimeMs: entry.loadTime, size: entry.size,
            tag: entry.element?.tagName, id: entry.element?.id, className: entry.element?.getAttribute('class'),
            text: entry.element?.textContent?.slice(0, 160), url: entry.url,
          })
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true })
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__cpfBenchmark.shifts.push({ startTime: entry.startTime, value: entry.value })
        }
      }).observe({ type: 'layout-shift', buffered: true })
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__cpfBenchmark.longTaskCount += 1
          window.__cpfBenchmark.longTaskDuration += entry.duration
        }
      }).observe({ type: 'longtask', buffered: true })
    })
    const session = await page.createCDPSession()
    try {
      await session.send('Network.enable')
      await session.send('Network.setCacheDisabled', { cacheDisabled: true })
      await session.send('Network.emulateNetworkConditions', { offline: false, latency: NETWORK.latencyMs, downloadThroughput: NETWORK.downloadBps, uploadThroughput: NETWORK.uploadBps, connectionType: 'cellular4g' })
      await session.send('Emulation.setCPUThrottlingRate', { rate: 4 })
      await session.send('Performance.enable')
      const response = await page.goto(scenarioUrl(baseUrl, scenario), { waitUntil: 'load', timeout: 30_000 })
      if (!response || response.status() >= 400) throw new Error(`Navigation failed for ${scenario}: HTTP ${response?.status() || 'no response'}`)
      await page.waitForFunction((expectedScenario) => {
        const root = document.querySelector('#root')
        if (!root) return false
        if (expectedScenario.startsWith('results')) return root.textContent?.includes('Marketplace search for') && document.querySelectorAll('.listing-card').length > 0
        const makeInput = document.querySelector('input[placeholder="Select make"]')
        return root.textContent?.includes('Find the right part.') && makeInput instanceof HTMLInputElement && !makeInput.disabled
      }, { timeout: 10_000 }, scenario)
      const usableContentMs = await page.evaluate(() => performance.now())
      await page.waitForNetworkIdle({ idleTime: 250, timeout: 3_000 }).catch(() => {})
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const browserMetrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0]
        const resources = performance.getEntriesByType('resource')
        const fcp = performance.getEntriesByType('paint').find((entry) => entry.name === 'first-contentful-paint')
        return {
          ttfbMs: navigation.responseStart - navigation.startTime,
          domContentLoadedMs: navigation.domContentLoadedEventEnd - navigation.startTime,
          loadMs: navigation.loadEventEnd - navigation.startTime,
          firstContentfulPaintMs: fcp?.startTime,
          largestContentfulPaintMs: window.__cpfBenchmark.lcp,
          lcpCandidates: window.__cpfBenchmark.lcpCandidates,
          resourceTimings: resources.map((entry) => ({ path: new URL(entry.name).pathname, startMs: entry.startTime, durationMs: entry.duration, bytes: entry.transferSize })),
          cumulativeLayoutShift: window.__cpfBenchmark.shifts,
          longTaskCount: window.__cpfBenchmark.longTaskCount,
          longTaskDurationMs: window.__cpfBenchmark.longTaskDuration,
          resourceCount: resources.length,
          transferredBytes: navigation.transferSize + resources.reduce((sum, entry) => sum + entry.transferSize, 0),
          javascriptTransferredBytes: resources.filter((entry) => new URL(entry.name).pathname.endsWith('.js')).reduce((sum, entry) => sum + entry.transferSize, 0),
          cssTransferredBytes: resources.filter((entry) => entry.initiatorType === 'css' || entry.name.endsWith('.css')).reduce((sum, entry) => sum + entry.transferSize, 0),
        }
      })
      validateMetric('firstContentfulPaintMs', browserMetrics.firstContentfulPaintMs)
      validateMetric('largestContentfulPaintMs', browserMetrics.largestContentfulPaintMs)
      if (consoleErrors.length) throw new Error(`Runtime console errors: ${consoleErrors.join('; ')}`)
      if (localFailures.length) throw new Error(`Unexpected local request failures: ${localFailures.join('; ')}`)
      const { metrics } = await session.send('Performance.getMetrics')
      const metric = (name) => metrics.find((entry) => entry.name === name)?.value ?? 0
      const sample = {
        ...browserMetrics,
        usableContentMs,
        cumulativeLayoutShift: calculateCls(browserMetrics.cumulativeLayoutShift),
        scriptDurationMs: metric('ScriptDuration') * 1000,
        taskDurationMs: metric('TaskDuration') * 1000,
        jsHeapUsedBytes: metric('JSHeapUsedSize'),
      }
      if (screenshotPath) {
        mkdirSync(path.dirname(screenshotPath), { recursive: true })
        await page.screenshot({ path: screenshotPath, fullPage: true })
      }
      return sample
    } finally {
      await session.detach().catch(() => {})
    }
  } finally {
    await context.close()
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const distDir = path.resolve(ROOT, options.dist || 'dist')
  const chrome = options.chrome || detectedChrome()
  if (!chrome) throw new Error('Chrome was not found. Set CHROME_PATH or pass --chrome=/path/to/chrome.')
  if (!existsSync(chrome)) throw new Error(`Chrome executable does not exist: ${chrome}`)
  const baseline = options.baseline ? JSON.parse(readFileSync(options.baseline, 'utf8')) : null
  if (options.output && existsSync(options.output)) throw new Error(`Report already exists; choose a new --output path: ${options.output}`)
  const fixture = options.url ? null : await startFixtureServer(distDir, { images: true, slowSearchMs: 800 })
  const baseUrl = options.url || fixture.url
  let browser
  try {
    browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--disable-background-networking', '--disable-default-apps', '--disable-extensions', '--disable-sync', '--metrics-recording-only', '--no-first-run'] })
    const measurements = {}
    for (const profile of Object.keys(PROFILES)) {
      measurements[profile] = {}
      for (const scenario of SCENARIOS) {
        const samples = []
        for (let run = 0; run < options.runs; run += 1) {
          samples.push(await measurePage(browser, { baseUrl, profile, scenario, screenshotPath: options.screenshots && run === 0 ? path.join(options.screenshots, `${profile}-${scenario}.png`) : null }))
        }
        measurements[profile][scenario] = { samples, summary: roundSummary(summarizeSamples(samples)) }
        console.error(`Measured ${profile}/${scenario}: ${options.runs} cold runs`)
      }
    }
    if (fixture?.unexpectedRequests.length) throw new Error(`Unexpected fixture requests: ${fixture.unexpectedRequests.join('; ')}`)
    const browserVersion = await browser.version()
    const report = {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      mode: options.url ? 'local-external-server' : 'deterministic-fixture',
      fixture: options.url ? null : { vehicle: FIXTURE_VEHICLE, part: 'Brake Pads', image: 'editorial/parts-workbench.webp', slowSearchMs: 800, excludedThirdParties: true, externalRequestsBlocked: true },
      scenarios: SCENARIOS,
      profiles: Object.keys(PROFILES),
      viewports: PROFILES,
      conditions: { cache: 'disabled', network: '1.6 Mbps down / 750 Kbps up / 150 ms latency', cpuSlowdown: '4x', thirdPartyRequests: 'blocked', browserMode: 'headless', viewportProfiles: PROFILES },
      runConfiguration: { runs: options.runs, url: baseUrl, screenshots: Boolean(options.screenshots) },
      environment: { browser: browserMetadata(browserVersion), node: process.version, os: `${process.platform} ${os.release()} ${process.arch}`, git: gitMetadata(), buildFingerprint: buildFingerprint(distDir) },
      build: initialAssetSizes(distDir),
      measurements,
    }
    const comparison = baseline ? compareReports(report, baseline, options.maxRegression) : null
    const budgets = absoluteBudgetReport(report, baseline)
    report.comparison = comparison
    report.absoluteBudgets = budgets
    if (options.output) {
      mkdirSync(path.dirname(options.output), { recursive: true })
      writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
    }
    console.log(JSON.stringify(report, null, 2))
    if (options.check) {
      if (baseline && !comparison.compatible) throw new Error(`Baseline rejected: ${comparison.reasons.join('; ')}`)
      const regressions = comparison?.comparisons.filter((item) => item.exceedsMaxRegression) ?? []
      const budgetFailures = budgets.filter((item) => item.passesEnforced === false)
      if (regressions.length || budgetFailures.length) throw new Error(`Benchmark check failed: ${regressions.length} p75 regression(s) above ${options.maxRegression}% and ${budgetFailures.length} enforceable budget failure(s)`)
    }
  } finally {
    try { await browser?.close() } finally { await fixture?.close() }
  }
}

main().catch((error) => {
  console.error(`benchmark:web failed: ${error instanceof Error ? error.message : error}`)
  process.exitCode = 1
})
