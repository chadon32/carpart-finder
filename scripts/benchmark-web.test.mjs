import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { SCHEMA_VERSION, absoluteBudgetReport, calculateCls, compareReports, initialAssetSizes, parseArgs, quantile, startFixtureServer, summarizeSamples } from './benchmark-web-lib.mjs'

test('quantile uses sorted linear interpolation', () => {
  assert.equal(quantile([40, 10, 30, 20], 0.5), 25)
  assert.equal(quantile([1, 2, 3, 4], 0.75), 3.25)
})

test('CLS uses 1 second gaps and a 5 second session window without rounding away small shifts', () => {
  assert.equal(calculateCls([{ startTime: 0, value: 0.0004 }, { startTime: 900, value: 0.0005 }, { startTime: 2001, value: 0.9 }]), 0.9)
  assert.equal(calculateCls([{ startTime: 0, value: 0.0004 }, { startTime: 900, value: 0.0005 }]), 0.0009)
})

test('initial asset inspection ignores external stylesheets but rejects missing local artifacts', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'benchmark-web-'))
  try {
    mkdirSync(path.join(dir, 'assets'))
    writeFileSync(path.join(dir, 'index.html'), '<link rel="stylesheet" href="https://fonts.example.invalid/fonts.css"><script type="module" src="/assets/missing.js"></script><link rel="stylesheet" href="/assets/missing.css">')
    assert.throws(() => initialAssetSizes(dir), /Missing initial JavaScript build artifact/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('argument validation rejects bad runs, remote URLs, and unknown arguments', () => {
  assert.throws(() => parseArgs(['--runs=0']), /between 1 and 20/)
  assert.throws(() => parseArgs(['--url=https://example.com']), /loopback/)
  assert.throws(() => parseArgs(['--url=http://user@127.0.0.1:4173']), /loopback/)
  assert.equal(parseArgs(['--url=http://[::1]:4173']).url, 'http://[::1]:4173')
  assert.throws(() => parseArgs(['--unknown=value']), /Unknown argument/)
  assert.equal(parseArgs(['--runs=1', '--url=http://127.0.0.1:4173']).runs, 1)
})

test('comparison rejects mismatched benchmark conditions instead of reporting gains', () => {
  const report = {
    schemaVersion: SCHEMA_VERSION, scenarios: ['home'], profiles: ['desktop'], conditions: { cpuSlowdown: '4x' }, environment: { browser: { major: '140' } },
    measurements: { desktop: { home: { summary: { largestContentfulPaintMs: { p75: 1000 } } } } },
  }
  const result = compareReports(report, { ...report, conditions: { cpuSlowdown: '1x' } }, 15)
  assert.equal(result.compatible, false)
  assert.match(result.reasons.join(' '), /conditions/)
})

test('fixture server exposes a loopback URL and async close', async () => {
  // Unit tests must run on a fresh checkout before a dist build exists.
  const dir = mkdtempSync(path.join(os.tmpdir(), 'benchmark-web-'))
  writeFileSync(path.join(dir, 'index.html'), '<h1>Test fixture</h1><script src="https://example.invalid/track.js"></script>')
  const server = await startFixtureServer(dir)
  try {
    assert.match(server.url, /^http:\/\/127\.0\.0\.1:\d+$/)
    const response = await fetch(`${server.url}/api/health`)
    assert.equal(response.status, 200)
    assert.equal((await response.json()).fitmentContractVersion, 2)
    const html = await fetch(server.url, { headers: { 'accept-encoding': 'gzip' } })
    assert.equal(html.headers.get('content-encoding'), 'gzip')
    assert.equal(await html.text(), '<h1>Test fixture</h1>')
    assert.equal((await fetch(`${server.url}/api/unexpected`)).status, 404)
    assert.equal((await fetch(`${server.url}/api/health`, { method: 'POST' })).status, 405)
    assert.equal(server.unexpectedRequests.length, 2)
  } finally {
    await server.close()
    rmSync(dir, { recursive: true, force: true })
  }
  await assert.rejects(fetch(server.url))
})

test('fixture strips external fetches but preserves canonical metadata for SEO tests', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'benchmark-web-'))
  const metadata = '<link rel="canonical" href="https://carpartsradar.com/"><link rel="alternate" href="https://carpartsradar.com/feed.xml">'
  writeFileSync(path.join(dir, 'index.html'), `${metadata}<link rel="stylesheet" href="https://example.invalid/font.css"><link rel="preconnect" href="https://example.invalid">`)
  const server = await startFixtureServer(dir)
  try {
    assert.equal(await (await fetch(server.url)).text(), metadata)
  } finally {
    await server.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('initial modulepreloads are deduplicated and lazy chunks are counted separately', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'benchmark-web-'))
  try {
    mkdirSync(path.join(dir, 'assets'))
    writeFileSync(path.join(dir, 'assets', 'entry.js'), 'export const entry = true')
    writeFileSync(path.join(dir, 'assets', 'lazy.js'), 'export const lazy = true')
    writeFileSync(path.join(dir, 'assets', 'style.css'), 'body { color: black }')
    writeFileSync(path.join(dir, 'index.html'), '<script type="module" src="/assets/entry.js"></script><link rel="modulepreload" href="/assets/entry.js"><link rel="stylesheet" href="/assets/style.css"><link rel="stylesheet" href="//fonts.example.invalid/style.css">')
    const sizes = initialAssetSizes(dir)
    assert.deepEqual(sizes.initialJavaScript.files, ['assets/entry.js'])
    assert.equal(sizes.totalJavaScriptChunks.files.length, 2)
    assert.ok(sizes.initialJavaScript.gzipBytes > 0)
    assert.deepEqual(sizes.initialCss.files, ['assets/style.css'])
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('CLS splits a continuously shifting sequence after five seconds', () => {
  assert.ok(Math.abs(calculateCls(Array.from({ length: 8 }, (_, i) => ({ startTime: i * 900, value: 0.01 }))) - 0.06) < 1e-10)
})

test('statistics reject invalid inputs and retain fractional medians', () => {
  assert.throws(() => quantile([], 0.5))
  assert.throws(() => quantile([NaN], 0.5))
  assert.throws(() => quantile([1], 2))
  assert.throws(() => summarizeSamples([]))
  assert.deepEqual(summarizeSamples([{ cls: 0.001 }, { cls: 0.002 }]).cls, { min: 0.001, median: 0.0015, p75: 0.00175, max: 0.002 })
})

test('CLI rejects duplicate, blank, fractional and excessive options', () => {
  for (const args of [['--runs=21'], ['--runs=1.5'], ['--runs=NaN'], ['--chrome='], ['--output='], ['--dist='], ['--check', '--check'], ['--max-regression=-1']]) {
    assert.throws(() => parseArgs(args), args.join(' '))
  }
})

test('CLI can measure a preserved build without rebuilding or overwriting it', () => {
  assert.equal(parseArgs(['--dist=artifacts/baseline-dist']).dist, 'artifacts/baseline-dist')
})

test('image and delayed-search fixtures are opt-in, bounded and first-party', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'benchmark-web-'))
  writeFileSync(path.join(dir, 'index.html'), '<h1>Fixture</h1>')
  let server
  try {
    await assert.rejects(startFixtureServer(dir, { slowSearchMs: -1 }), /slowSearchMs/)
    await assert.rejects(startFixtureServer(dir, { images: true }), /Missing first-party/)
    mkdirSync(path.join(dir, 'editorial'))
    writeFileSync(path.join(dir, 'editorial', 'parts-workbench.webp'), 'unit-test-image')
    server = await startFixtureServer(dir, { images: true, slowSearchMs: 60 })
    const query = '/api/search?year=2020&make=Toyota&model=Camry&part=Brake+Pads'
    const start = performance.now()
    const response = await fetch(server.url + query, { headers: { referer: `${server.url}/?benchmarkSlow=1` } })
    const payload = await response.json()
    assert.ok(performance.now() - start >= 50, 'slow scenario must include its configured server delay')
    assert.equal(payload.results[0].image, '/editorial/parts-workbench.webp')
    assert.equal((await fetch(server.url + payload.results[0].image)).headers.get('content-type'), 'image/webp')
    assert.deepEqual(server.unexpectedRequests, [])
  } finally {
    await server?.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('missing metrics and mismatched fixture mode cannot pass a comparison', () => {
  const report = {
    schemaVersion: SCHEMA_VERSION, mode: 'deterministic-fixture', scenarios: ['home'], profiles: ['desktop'],
    conditions: {}, environment: { browser: { major: '152' } }, measurements: { desktop: { home: { summary: {} } } },
  }
  assert.equal(compareReports(report, report, 15).compatible, false)
  assert.match(compareReports(report, { ...report, mode: 'local-external-server' }, 15).reasons.join(' '), /mode/)
})

test('absolute budget reporting does not label missing or failing baselines as a pass', () => {
  const report = { profiles: ['desktop'], scenarios: ['home'], measurements: { desktop: { home: { summary: { cumulativeLayoutShift: { p75: 0.2 }, largestContentfulPaintMs: { p75: 3000 } } } } } }
  for (const budget of absoluteBudgetReport(report, null)) {
    assert.equal(budget.withinBudget, false)
    assert.equal(budget.passesEnforced, null)
  }
  const baseline = structuredClone(report)
  baseline.measurements.desktop.home.summary.cumulativeLayoutShift.p75 = 0
  baseline.measurements.desktop.home.summary.largestContentfulPaintMs.p75 = 2000
  assert.ok(absoluteBudgetReport(report, baseline).every((budget) => budget.passesEnforced === false))
})
