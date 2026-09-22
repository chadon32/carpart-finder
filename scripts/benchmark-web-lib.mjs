import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { gzipSync } from 'node:zlib'

export const SCHEMA_VERSION = 'benchmark-web/v3'
export const FIXTURE_VEHICLE = { year: '2020', make: 'Toyota', model: 'Camry', trim: 'LE' }
export const FIXTURE_PART = 'Brake Pads'

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])
const REQUIRED_METRICS = [
  'ttfbMs', 'domContentLoadedMs', 'loadMs', 'firstContentfulPaintMs', 'largestContentfulPaintMs',
  'cumulativeLayoutShift', 'longTaskCount', 'longTaskDurationMs', 'resourceCount', 'transferredBytes',
  'javascriptTransferredBytes', 'cssTransferredBytes', 'scriptDurationMs', 'taskDurationMs', 'jsHeapUsedBytes', 'usableContentMs',
]
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8',
}

export function quantile(values, percentile) {
  if (!Array.isArray(values) || values.length === 0) throw new Error('quantile requires at least one value')
  if (!Number.isFinite(percentile) || percentile < 0 || percentile > 1) throw new Error('percentile must be between 0 and 1')
  const sorted = [...values]
  if (!sorted.every(Number.isFinite)) throw new Error('quantile values must be finite numbers')
  sorted.sort((a, b) => a - b)
  const position = (sorted.length - 1) * percentile
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}

export function calculateCls(entries) {
  const shifts = [...entries]
    .filter((entry) => Number.isFinite(entry.value) && entry.value >= 0 && Number.isFinite(entry.startTime))
    .sort((a, b) => a.startTime - b.startTime)
  let largest = 0
  let sessionStart = null
  let previous = null
  let sessionValue = 0
  for (const entry of shifts) {
    if (sessionStart === null || entry.startTime - previous > 1000 || entry.startTime - sessionStart > 5000) {
      sessionStart = entry.startTime
      sessionValue = 0
    }
    sessionValue += entry.value
    largest = Math.max(largest, sessionValue)
    previous = entry.startTime
  }
  return largest
}

export function parseArgs(argv, environment = process.env) {
  const options = {
    runs: 5,
    chrome: environment.CHROME_PATH || null,
    url: null,
    output: null,
    baseline: null,
    maxRegression: 15,
    check: false,
    screenshots: null,
    dist: null,
  }
  const seen = new Set()
  for (const arg of argv) {
    if (arg === '--check') {
      if (seen.has('check')) throw new Error('--check was supplied more than once')
      seen.add('check')
      options.check = true
      continue
    }
    const match = /^--([a-z-]+)=(.*)$/.exec(arg)
    if (!match) throw new Error(`Unknown or malformed argument: ${arg}`)
    const [, key, value] = match
    if (seen.has(key)) throw new Error(`--${key} was supplied more than once`)
    seen.add(key)
    if (key === 'runs') options.runs = Number(value)
    else if (key === 'chrome') options.chrome = value
    else if (key === 'url') options.url = value
    else if (key === 'output') options.output = value
    else if (key === 'baseline') options.baseline = value
    else if (key === 'max-regression') options.maxRegression = Number(value)
    else if (key === 'screenshots') options.screenshots = value
    else if (key === 'dist') options.dist = value
    else throw new Error(`Unknown argument: --${key}`)
  }
  if (!Number.isInteger(options.runs) || options.runs < 1 || options.runs > 20) {
    throw new Error('--runs must be an integer between 1 and 20')
  }
  if (!Number.isFinite(options.maxRegression) || options.maxRegression < 0) {
    throw new Error('--max-regression must be a non-negative number')
  }
  for (const key of ['chrome', 'output', 'baseline', 'screenshots', 'dist']) {
    if (options[key] === '') throw new Error(`--${key} requires a value`)
  }
  if (options.url !== null && !isLoopbackUrl(options.url)) {
    throw new Error('--url must be an explicitly supplied loopback HTTP URL (localhost, 127.0.0.1, or ::1)')
  }
  return options
}

export function isLoopbackUrl(value) {
  try {
    const url = new URL(value)
    const hostname = url.hostname.replace(/^\[|\]$/g, '')
    return url.protocol === 'http:' && !url.username && !url.password && LOOPBACK_HOSTS.has(hostname)
  } catch {
    return false
  }
}

function taggedAssetNames(html, tagName, predicate, attribute) {
  const tags = html.match(new RegExp(`<${tagName}\\b[^>]*>`, 'gi')) ?? []
  return tags
    .filter(predicate)
    .map((tag) => new RegExp(`${attribute}=["']([^"']+)["']`, 'i').exec(tag)?.[1])
    .filter((href) => href?.startsWith('/assets/'))
    .map((href) => href.slice(1))
}

function summarizeFiles(distDir, names, label) {
  const uniqueNames = [...new Set(names)]
  if (uniqueNames.length === 0) throw new Error(`No ${label} build artifacts were referenced by dist/index.html`)
  const files = uniqueNames.map((name) => {
    if (!name.startsWith('assets/') || name.includes('..')) throw new Error(`Unsafe ${label} artifact reference: ${name}`)
    const file = resolve(distDir, name)
    if (!file.startsWith(`${resolve(distDir)}${sep}`) || !existsSync(file)) {
      throw new Error(`Missing ${label} build artifact: ${name}`)
    }
    return { name, bytes: statSync(file).size, gzipBytes: gzipSync(readFileSync(file)).byteLength }
  })
  return {
    files: files.map((file) => file.name),
    bytes: files.reduce((total, file) => total + file.bytes, 0),
    gzipBytes: files.reduce((total, file) => total + file.gzipBytes, 0),
  }
}

export function initialAssetSizes(distDir) {
  const htmlFile = join(distDir, 'index.html')
  if (!existsSync(htmlFile)) throw new Error(`Missing build artifact: ${htmlFile}`)
  const html = readFileSync(htmlFile, 'utf8')
  const moduleScripts = taggedAssetNames(html, 'script', (tag) => /\btype=["']module["']/i.test(tag), 'src')
  const modulePreloads = taggedAssetNames(html, 'link', (tag) => /\brel=["']modulepreload["']/i.test(tag), 'href')
  const css = taggedAssetNames(html, 'link', (tag) => /\brel=["']stylesheet["']/i.test(tag), 'href')
  const initialJavaScript = summarizeFiles(distDir, [...moduleScripts, ...modulePreloads], 'initial JavaScript')
  const initialCss = summarizeFiles(distDir, css, 'initial CSS')
  const allJs = readdirSync(join(distDir, 'assets')).filter((name) => name.endsWith('.js')).map((name) => `assets/${name}`)
  if (allJs.length === 0) throw new Error('No JavaScript chunks were found in dist/assets')
  return {
    initialJavaScript,
    initialCss,
    totalJavaScriptChunks: summarizeFiles(distDir, allJs, 'JavaScript chunk'),
  }
}

export function buildFingerprint(distDir) {
  const hash = createHash('sha256')
  const names = ['index.html', ...readdirSync(join(distDir, 'assets')).sort().map((name) => `assets/${name}`)]
  for (const name of names) {
    hash.update(name)
    hash.update(readFileSync(join(distDir, name)))
  }
  return `sha256:${hash.digest('hex')}`
}

export function summarizeSamples(samples) {
  if (!samples.length) throw new Error('Cannot summarize zero samples')
  const keys = Object.keys(samples[0]).filter((key) => samples.every((sample) => Number.isFinite(sample[key])))
  return Object.fromEntries(keys.map((key) => {
    const values = samples.map((sample) => sample[key])
    return [key, { min: quantile(values, 0), median: quantile(values, 0.5), p75: quantile(values, 0.75), max: quantile(values, 1) }]
  }))
}

export function compareReports(current, baseline, maxRegression) {
  const reasons = []
  if (current?.schemaVersion !== SCHEMA_VERSION || baseline?.schemaVersion !== SCHEMA_VERSION) reasons.push(`schemaVersion must be ${SCHEMA_VERSION}`)
  for (const key of ['mode', 'fixture', 'scenarios', 'profiles', 'viewports', 'conditions']) {
    if (JSON.stringify(current?.[key]) !== JSON.stringify(baseline?.[key])) reasons.push(`mismatched ${key}`)
  }
  if (current?.environment?.browser?.major !== baseline?.environment?.browser?.major) reasons.push('mismatched Chrome major version')
  if (reasons.length) return { compatible: false, reasons, comparisons: [] }
  const comparisons = []
  for (const profile of current.profiles) {
    for (const scenario of current.scenarios) {
      const currentSummary = current.measurements?.[profile]?.[scenario]?.summary
      const baselineSummary = baseline.measurements?.[profile]?.[scenario]?.summary
      if (!currentSummary || !baselineSummary) return { compatible: false, reasons: [`missing ${profile}/${scenario} summary`], comparisons: [] }
      for (const metric of REQUIRED_METRICS) {
        if (!Number.isFinite(currentSummary[metric]?.p75) || !Number.isFinite(baselineSummary[metric]?.p75)) {
          return { compatible: false, reasons: [`missing required ${metric} p75 for ${profile}/${scenario}`], comparisons: [] }
        }
        const currentP75 = currentSummary[metric].p75
        const baselineP75 = baselineSummary[metric].p75
        const percentChange = baselineP75 === 0 ? null : ((currentP75 - baselineP75) / baselineP75) * 100
        comparisons.push({ profile, scenario, metric, baselineP75, currentP75, percentChange, exceedsMaxRegression: percentChange !== null && percentChange > maxRegression })
      }
    }
  }
  return { compatible: true, reasons: [], comparisons }
}

export function absoluteBudgetReport(report, baseline) {
  const budgets = [
    ['cumulativeLayoutShift', 0.1],
    ['largestContentfulPaintMs', 2500],
  ]
  return report.profiles.flatMap((profile) => report.scenarios.flatMap((scenario) => budgets.map(([metric, limit]) => {
    const value = report.measurements[profile][scenario].summary[metric]?.p75
    const baselineValue = baseline?.measurements?.[profile]?.[scenario]?.summary[metric]?.p75
    const enforceable = Number.isFinite(baselineValue) && baselineValue <= limit
    const withinBudget = Number.isFinite(value) && value <= limit
    return { profile, scenario, metric, limit, value, baselineValue: baselineValue ?? null, withinBudget, enforceable, passesEnforced: enforceable ? withinBudget : null }
  })))
}

function fixtureResponse(pathname, search) {
  const params = new URLSearchParams(search)
  const fixedSearch = params.get('year') === FIXTURE_VEHICLE.year
    && params.get('make') === FIXTURE_VEHICLE.make
    && params.get('model') === FIXTURE_VEHICLE.model
    && params.get('part') === FIXTURE_PART
  if (pathname === '/api/health') return { status: 200, body: { status: 'ok', apiRelease: 'benchmark-fixture', buildId: 'benchmark-fixture', fitmentContractVersion: 2 } }
  if (pathname === '/api/makes') return { status: 200, body: { makes: ['Toyota'] } }
  if (pathname === '/api/models' && params.get('make') === 'Toyota' && params.get('year') === '2020') return { status: 200, body: { models: ['Camry'] } }
  if (pathname === '/api/trims' && params.get('make') === 'Toyota' && params.get('year') === '2020' && params.get('model') === 'Camry') return { status: 200, body: { trims: ['LE'] } }
  if (pathname === '/api/vehicle-image') return { status: 200, body: { imageUrl: null } }
  if (pathname === '/api/search' && fixedSearch) {
    return {
      status: 200,
      body: {
        fitmentContractVersion: 2,
        query: '2020 Toyota Camry LE Brake Pads',
        results: [
          {
            id: 'benchmark-brake-pads-1', title: '2020 Toyota Camry Front Brake Pad Set', price: 42.99, currency: 'USD', condition: 'New', seller: 'Fixture Parts', sellerFeedbackPercentage: '99.8', sellerFeedbackScore: 1234, image: null, link: 'https://example.invalid/listing/benchmark-brake-pads-1', source: 'Fixture marketplace', crossBorder: false, itemLocation: 'Phoenix, AZ', shippingCost: 0, verifiedFitment: true, fitmentTier: 'verified', fitmentProof: 'Fixture exact YMM evidence', fitmentEvidence: { provider: 'benchmark-fixture', matchType: 'EXACT', scope: 'year-make-model-trim', matchedVehicle: FIXTURE_VEHICLE, checkedAt: '2026-01-01T00:00:00.000Z', note: 'Deterministic benchmark fixture' },
          },
          {
            id: 'benchmark-brake-pads-2', title: 'Toyota Camry Ceramic Brake Pads', price: 49.5, currency: 'USD', condition: 'New', seller: 'Fixture Auto', sellerFeedbackPercentage: '98.9', sellerFeedbackScore: 890, image: null, link: 'https://example.invalid/listing/benchmark-brake-pads-2', source: 'Fixture marketplace', crossBorder: false, shippingCost: 4.99, verifiedFitment: true, fitmentTier: 'verified', fitmentProof: 'Fixture exact YMM evidence', fitmentEvidence: { provider: 'benchmark-fixture', matchType: 'EXACT', scope: 'year-make-model', matchedVehicle: FIXTURE_VEHICLE, checkedAt: '2026-01-01T00:00:00.000Z', note: 'Deterministic benchmark fixture' },
          },
        ],
        fallbackResults: [], fitmentSummary: { verified: 2, fallback: 0, hiddenIrrelevantFallbacks: 0 }, providerErrors: {}, skippedProviders: [], cached: false,
      },
    }
  }
  if (pathname === '/api/price-history' && fixedSearch) return { status: 200, body: { observations: [{ date: '2026-01-01', price: 44.99 }, { date: '2026-01-02', price: 42.99 }] } }
  return { status: 404, body: { error: `Unexpected fixture request: ${pathname}` } }
}

function sendJson(response, status, body) {
  const content = Buffer.from(JSON.stringify(body))
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': content.length, 'cache-control': 'no-store' })
  response.end(content)
}

function strippedHtml(html) {
  return html
    .replace(/<script\b[^>]*\bsrc=["']https?:[^"']+["'][^>]*>\s*<\/script>/gi, '')
    .replace(/<link\b[^>]*\bhref=["']https?:[^"']+["'][^>]*>/gi, '')
}

export async function startFixtureServer(distDir, { images = false, slowSearchMs = 0 } = {}) {
  if (!existsSync(join(distDir, 'index.html'))) throw new Error(`Cannot start fixture server: missing ${join(distDir, 'index.html')}`)
  if (!Number.isFinite(slowSearchMs) || slowSearchMs < 0 || slowSearchMs > 10_000) throw new Error('slowSearchMs must be between 0 and 10000')
  if (images && !existsSync(join(distDir, 'editorial/parts-workbench.webp'))) throw new Error('Missing first-party fixture image')
  const unexpectedRequests = []
  const root = resolve(distDir)
  const server = createServer((request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1')
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        unexpectedRequests.push(`${request.method} ${url.pathname}`)
        sendJson(response, 405, { error: 'Benchmark fixture only accepts GET and HEAD' })
        return
      }
      if (url.pathname.startsWith('/api/')) {
        const fixture = fixtureResponse(url.pathname, url.search)
        if (fixture.status >= 400) unexpectedRequests.push(`${request.method} ${url.pathname}${url.search}`)
        if (images && fixture.body.results) {
          // A real first-party WebP exercises image transfer/decode/layout,
          // without calling a marketplace or pretending this is live inventory.
          for (const listing of fixture.body.results) listing.image = '/editorial/parts-workbench.webp'
        }
        const delay = url.pathname === '/api/search' && request.headers.referer?.includes('benchmarkSlow=1') ? slowSearchMs : 0
        if (delay) {
          const timer = setTimeout(() => sendJson(response, fixture.status, fixture.body), delay)
          response.once('close', () => clearTimeout(timer))
        } else sendJson(response, fixture.status, fixture.body)
        return
      }
      const requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '')
      const file = resolve(root, normalize(requested))
      if (!file.startsWith(`${root}${sep}`) || !existsSync(file) || statSync(file).isDirectory()) {
        unexpectedRequests.push(`${request.method} ${url.pathname}`)
        sendJson(response, 404, { error: 'Benchmark fixture static asset not found' })
        return
      }
      const extension = extname(file)
      const type = MIME_TYPES[extension] || 'application/octet-stream'
      const source = extension === '.html' ? Buffer.from(strippedHtml(readFileSync(file, 'utf8'))) : readFileSync(file)
      const gzip = /\bgzip\b/.test(request.headers['accept-encoding'] || '') && (type.startsWith('text/') || type.includes('javascript') || type.includes('json') || type.includes('xml'))
      const body = gzip ? gzipSync(source) : source
      const headers = {
        'content-type': type,
        'content-length': body.length,
        'cache-control': 'no-store',
        ...(gzip ? { 'content-encoding': 'gzip', vary: 'accept-encoding' } : {}),
      }
      response.writeHead(200, headers)
      if (request.method === 'HEAD') response.end()
      else response.end(body)
    } catch (error) {
      unexpectedRequests.push(`${request.method || 'GET'} ${request.url || '/'}`)
      sendJson(response, 500, { error: error instanceof Error ? error.message : 'Fixture server error' })
    }
  })
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolvePromise)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Fixture server did not expose a TCP address')
  return {
    url: `http://127.0.0.1:${address.port}`,
    unexpectedRequests,
    async close() { await new Promise((resolvePromise, reject) => server.close((error) => error ? reject(error) : resolvePromise())) },
  }
}
