import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { guides, legalPages, site, trustPages } from './editorial-content.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = resolve(root, 'public')

function wordCount(value) {
  return (JSON.stringify(value).match(/[A-Za-z0-9']+/g) ?? []).length
}

function localTarget(href) {
  const pathname = href.split('#')[0].split('?')[0]
  if (pathname === '/') return resolve(root, 'index.html')
  return resolve(publicDir, pathname.replace(/^\//, ''))
}

test('editorial library has substantial, distinct, sourced guides', () => {
  assert.ok(guides.length >= 8)
  assert.equal(new Set(guides.map(({ slug }) => slug)).size, guides.length)
  assert.equal(new Set(guides.map(({ title }) => title)).size, guides.length)

  for (const guide of guides) {
    assert.match(guide.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    assert.ok(wordCount(guide) >= 600, `${guide.slug} is too thin`)
    assert.ok(guide.intro.length >= 2, `${guide.slug} needs a useful introduction`)
    assert.ok(guide.sections.length >= 5, `${guide.slug} needs sufficient depth`)
    assert.ok(guide.sections.every(({ paragraphs }) => paragraphs.length >= 2))
    assert.ok(guide.takeaways.length >= 3)
    assert.ok(guide.checklist.length >= 5)
    assert.ok(guide.sources.length >= 2)
    assert.ok(guide.sources.every(({ url }) => url.startsWith('https://')))
  }
})

test('trust and legal copy covers the public publisher essentials', () => {
  assert.deepEqual(Object.keys(trustPages).sort(), ['about', 'contact', 'methodology'])
  assert.deepEqual(Object.keys(legalPages).sort(), ['disclosure', 'privacy', 'terms'])
  assert.match(site.email, /^[^@\s]+@[^@\s]+\.[^@\s]+$/)
  assert.ok(wordCount(trustPages.about) >= 250)
  assert.ok(wordCount(trustPages.methodology) >= 300)
  assert.ok(wordCount(legalPages.privacy) >= 450)
  assert.ok(wordCount(legalPages.terms) >= 450)
  assert.match(JSON.stringify(legalPages.disclosure), /affiliate/i)
  assert.match(JSON.stringify(legalPages.privacy), /account deletion/i)
})

test('generated pages expose metadata, policies, and working local navigation', async () => {
  const htmlPaths = [
    'guides.html',
    'about.html',
    'methodology.html',
    'contact.html',
    'privacy.html',
    'terms.html',
    'affiliate-disclosure.html',
    ...guides.map(({ slug }) => `guides/${slug}.html`),
  ]

  for (const relativePath of htmlPaths) {
    const html = await readFile(resolve(publicDir, relativePath), 'utf8')
    assert.match(html, /<title>[^<]+<\/title>/)
    assert.match(html, /<meta name="description" content="[^"]+" \/>/)
    assert.match(html, /<link rel="canonical" href="https:\/\/carpartsradar\.com\/[^"]*" \/>/)
    assert.match(html, /<script type="application\/ld\+json">\{"@context":"https:\/\/schema\.org","@graph":/)
    assert.match(html, /href="\/privacy\.html"/)
    assert.match(html, /href="\/terms\.html"/)
    assert.match(html, /href="\/affiliate-disclosure\.html"/)
    assert.match(html, /href="\/about\.html"/)
    assert.match(html, /href="\/contact\.html"/)
    assert.doesNotMatch(html, /href="#"/)
    assert.doesNotMatch(html, /[ \t]+$/m)
    assert.ok(html.endsWith('\n'))
    if (relativePath === 'contact.html') {
      assert.match(html, new RegExp(`href="mailto:${site.email}"`))
    }

    const hrefs = [...html.matchAll(/href="(\/[^"]+)"/g)].map((match) => match[1])
    for (const href of hrefs) {
      await assert.doesNotReject(stat(localTarget(href)), `${relativePath} has a broken link to ${href}`)
    }
  }
})

test('homepage remains understandable without JavaScript and exposes publisher identity metadata', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8')
  assert.match(html, /<meta name="author" content="CarPartsRadar Editorial" \/>/)
  assert.match(html, /<link rel="sitemap" type="application\/xml" href="\/sitemap\.xml" \/>/)
  assert.match(html, /<script type="application\/ld\+json">/)
  assert.match(html, /<noscript>[\s\S]*CarPartsRadar helps drivers and parts professionals/i)
  assert.match(html, /href="\/guides\.html"/)
  assert.match(html, /href="\/methodology\.html"/)
  assert.match(html, /href="\/affiliate-disclosure\.html"/)
})

test('sitemap and robots file advertise every public editorial page', async () => {
  const sitemap = await readFile(resolve(publicDir, 'sitemap.xml'), 'utf8')
  const robots = await readFile(resolve(publicDir, 'robots.txt'), 'utf8')
  const expectedPaths = [
    '/',
    '/guides.html',
    '/about.html',
    '/methodology.html',
    '/contact.html',
    '/privacy.html',
    '/terms.html',
    '/affiliate-disclosure.html',
    ...guides.map(({ slug }) => `/guides/${slug}.html`),
  ]

  for (const pathname of expectedPaths) {
    assert.match(sitemap, new RegExp(`<loc>${site.origin}${pathname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc>`))
  }
  assert.match(robots, /Sitemap: https:\/\/carpartsradar\.com\/sitemap\.xml/)
})

test('guide schema, dates, jump links and contextual recommendations match visible content', async () => {
  const sitemap = await readFile(resolve(publicDir, 'sitemap.xml'), 'utf8')
  const feed = await readFile(resolve(publicDir, 'feed.xml'), 'utf8')
  assert.doesNotMatch(feed, /<pubDate>|<lastBuildDate>/, 'Do not invent publication timestamps')
  assert.equal((sitemap.match(/<lastmod>/g) || []).length, guides.length)
  for (const guide of guides) {
    const html = await readFile(resolve(publicDir, `guides/${guide.slug}.html`), 'utf8')
    const schema = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])
    const article = schema['@graph'].find((item) => item['@type'] === 'Article')
    const breadcrumbs = schema['@graph'].find((item) => item['@type'] === 'BreadcrumbList')
    assert.equal(article.headline, guide.title)
    assert.equal(article.dateModified, guide.modified)
    assert.equal(article.author.name, 'CarPartsRadar Editorial')
    assert.match(html, new RegExp(`<time datetime="${guide.modified}">`))
    assert.equal(breadcrumbs.itemListElement.length, 3)
    assert.equal(breadcrumbs.itemListElement[2].item, `${site.origin}/guides/${guide.slug}.html`)
    assert.equal(new Set(guide.related).size, 3)
    for (const slug of guide.related) {
      assert.notEqual(slug, guide.slug)
      assert.ok(guides.some((item) => item.slug === slug))
      assert.ok(html.includes(`href="/guides/${slug}.html"`))
    }
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1])
    assert.equal(new Set(ids).size, ids.length, 'Anchor IDs must be unique')
    for (const match of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(match[1]), `Missing ${match[1]}`)
    assert.ok(html.includes(`href="/?guide=${guide.slug}"`))
    assert.doesNotMatch(html, /utm_source|utm_medium/, 'Internal links must not overwrite campaign attribution')
    assert.match(html, /loading="lazy" decoding="async"/)
  }
})

test('indexing rules exclude search/API URLs without blocking canonical pages', async () => {
  const config = JSON.parse(await readFile(resolve(root, 'vercel.json'), 'utf8'))
  assert.ok(config.redirects.some((rule) => rule.source === '/index.html' && rule.destination === '/' && rule.permanent))
  for (const key of ['year', 'make', 'model', 'trim', 'part']) {
    assert.ok(config.headers.some((rule) => rule.source === '/' && rule.has?.some((condition) => condition.type === 'query' && condition.key === key) && rule.headers.some((header) => header.key === 'X-Robots-Tag' && header.value === 'noindex, follow')))
  }
  assert.ok(config.headers.some((rule) => rule.source === '/api/:path*' && rule.headers.some((header) => header.key === 'X-Robots-Tag')))
  assert.ok(!config.headers.some((rule) => !rule.has && rule.source !== '/api/:path*' && rule.headers.some((header) => header.key === 'X-Robots-Tag')))
  const html = await readFile(resolve(root, 'index.html'), 'utf8')
  assert.match(html, /<link data-rh="true" rel="canonical"/)
  assert.match(html, /<script defer src="https:\/\/www.anrdoezrs.net/)
})
