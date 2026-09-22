// Read-only production smoke check. Does not submit forms or touch accounts.
import assert from 'node:assert/strict'
import { guides, site } from './editorial-content.mjs'

const origin = process.argv[2] || site.origin
assert.equal(new URL(origin).protocol, 'https:', 'Use an HTTPS deployment origin')
const request = (path, options) => fetch(new URL(path, origin), { signal: AbortSignal.timeout(20_000), ...options })
const sitemapResponse = await request('/sitemap.xml')
assert.equal(sitemapResponse.status, 200)
const sitemap = await sitemapResponse.text()
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
assert.equal(urls.length, 8 + guides.length)
assert.equal(new Set(urls).size, urls.length)
const titles = new Set()
const descriptions = new Set()
for (const url of urls) {
  assert.ok(url.startsWith(`${site.origin}/`))
  assert.equal(new URL(url).search, '')
  const path = new URL(url).pathname
  const response = await request(path, { redirect: 'manual' })
  assert.equal(response.status, 200, path)
  assert.doesNotMatch(response.headers.get('x-robots-tag') || '', /noindex/i, path)
  const html = await response.text()
  const canonical = [...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/g)]
  assert.equal(canonical.length, 1, `${path}: canonical count`)
  assert.equal(canonical[0][1], url, path)
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `${path}: one main heading`)
  const title = html.match(/<title\b[^>]*>(.*?)<\/title>/s)?.[1]
  const description = html.match(/<meta\b[^>]*name="description"[^>]*content="([^"]+)"/s)?.[1]
  assert.ok(title && description, `${path}: metadata`)
  assert.ok(!titles.has(title) && !descriptions.has(description), `${path}: duplicate metadata`)
  titles.add(title)
  descriptions.add(description)
  assert.doesNotMatch(html, /<meta\b[^>]*name="robots"[^>]*content="[^"]*noindex/i)
  const schemas = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)]
  assert.ok(schemas.length, `${path}: structured data`)
  for (const [, json] of schemas) JSON.parse(json)
  console.log(`PASS 200 / canonical / metadata / schema: ${path}`)
}
for (const key of ['year', 'make', 'model', 'trim', 'part']) {
  const response = await request(`/?${key}=seo-test`)
  assert.equal(response.status, 200)
  assert.match(response.headers.get('x-robots-tag') || '', /noindex, follow/i, key)
}
const campaign = await request('/?guide=compare-total-car-part-cost')
assert.doesNotMatch(campaign.headers.get('x-robots-tag') || '', /noindex/i)
const missing = await request('/seo-missing-page-test')
assert.equal(missing.status, 404)
const redirect = await request('/index.html?guide=compare-total-car-part-cost', { redirect: 'manual' })
assert.equal(redirect.status, 308)
const destination = new URL(redirect.headers.get('location'), origin)
assert.equal(destination.pathname, '/')
assert.equal(destination.searchParams.get('guide'), 'compare-total-car-part-cost')
const health = await request('/api/health')
assert.equal(health.status, 200)
assert.match(health.headers.get('x-robots-tag') || '', /noindex/)
const robots = await (await request('/robots.txt')).text()
assert.ok(robots.includes(`Sitemap: ${site.origin}/sitemap.xml`))
console.log('PASS search/API noindex, homepage indexability, 404, 308 with query preserved, API health and robots.txt')
