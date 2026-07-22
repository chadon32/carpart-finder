import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { guides, legalPages, site, trustPages } from './editorial-content.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = resolve(root, 'public')
const guideDir = resolve(publicDir, 'guides')

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function canonical(path) {
  return `${site.origin}${path}`
}

function textWithContactLink(value) {
  const escaped = escapeHtml(value)
  const escapedEmail = escapeHtml(site.email)
  return escaped.replaceAll(escapedEmail, `<a href="mailto:${escapedEmail}">${escapedEmail}</a>`)
}

function header() {
  return `
    <a class="skip-link" href="#main-content">Skip to content</a>
    <header class="site-header">
      <div class="shell header-inner">
        <a class="brand" href="/" aria-label="CarPartsRadar home">
          <span class="brand-mark"><img src="/favicon.svg" alt="" width="30" height="30" /></span>
          <span class="brand-copy"><strong>CarParts<span>Radar</span></strong><small>Live price comparison</small></span>
        </a>
        <nav class="primary-nav" aria-label="Primary navigation">
          <a href="/guides.html">Guides</a>
          <a href="/methodology.html">Methodology</a>
          <a href="/about.html">About</a>
          <a class="nav-cta" href="/">Compare parts</a>
        </nav>
      </div>
    </header>`
}

function footer() {
  return `
    <footer class="site-footer">
      <div class="shell footer-grid">
        <div>
          <a class="footer-brand" href="/">CarParts<span>Radar</span></a>
          <p>Independent automotive listing comparison with fitment evidence kept visible.</p>
        </div>
        <div>
          <h2>Explore</h2>
          <a href="/guides.html">Buying guides</a>
          <a href="/methodology.html">Methodology</a>
          <a href="/about.html">About</a>
          <a href="/contact.html">Contact</a>
        </div>
        <div>
          <h2>Policies</h2>
          <a href="/privacy.html">Privacy</a>
          <a href="/terms.html">Terms</a>
          <a href="/affiliate-disclosure.html">Affiliate disclosure</a>
        </div>
      </div>
      <div class="shell footer-bottom">
        <p>© ${new Date().getFullYear()} CarPartsRadar. We are not a retailer and do not sell listed products.</p>
        <p>Some outbound links may earn us a commission at no added cost to you.</p>
      </div>
    </footer>`
}

function pageShell({ title, description, path, body, type = 'website' }) {
  const pageTitle = title === site.name ? title : `${title} | ${site.name}`
  const pageUrl = canonical(path)
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#2050c8" />
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${pageUrl}" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="stylesheet" href="/editorial.css" />
  <meta property="og:type" content="${type}" />
  <meta property="og:site_name" content="CarPartsRadar" />
  <meta property="og:title" content="${escapeHtml(pageTitle)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:image" content="${site.origin}/editorial/parts-workbench.webp" />
  <meta name="twitter:card" content="summary_large_image" />
</head>
<body>
  ${header()}
  ${body}
  ${footer()}
</body>
</html>`
}

function breadcrumb(items) {
  return `<nav class="breadcrumb" aria-label="Breadcrumb">${items
    .map((item, index) => index === items.length - 1
      ? `<span aria-current="page">${escapeHtml(item.label)}</span>`
      : `<a href="${item.href}">${escapeHtml(item.label)}</a><span aria-hidden="true">/</span>`)
    .join('')}</nav>`
}

function guideCard(guide, compact = false) {
  return `<article class="guide-card${compact ? ' guide-card-compact' : ''}">
    <p class="eyebrow">${escapeHtml(guide.category)}</p>
    <h2><a href="/guides/${guide.slug}.html">${escapeHtml(guide.title)}</a></h2>
    <p>${escapeHtml(guide.description)}</p>
    <a class="text-link" href="/guides/${guide.slug}.html" aria-label="Read ${escapeHtml(guide.title)}">Read guide <span aria-hidden="true">→</span></a>
  </article>`
}

function guideIndex() {
  const body = `
    <main id="main-content">
      <section class="guide-hero">
        <div class="shell guide-hero-grid">
          <div class="guide-hero-copy">
            <p class="eyebrow">CarPartsRadar field guides</p>
            <h1>Buy the right part with fewer expensive guesses.</h1>
            <p>Practical, independently written guidance for fitment, product quality, total cost, and safer purchasing decisions.</p>
          </div>
          <figure class="hero-photo">
            <img src="/editorial/parts-workbench.webp" width="1440" height="960" alt="Brake pads, an alternator, a starter motor, an oxygen sensor, spark plugs, and an air filter arranged on a mechanic's workbench" />
            <figcaption>Common replacement parts can share a listing category while requiring very different fitment checks.</figcaption>
          </figure>
        </div>
      </section>

      <section class="shell guide-library" aria-labelledby="guide-library-title">
        <div class="section-heading">
          <p class="eyebrow">Reviewed ${site.updated}</p>
          <h2 id="guide-library-title">Automotive buying guides</h2>
          <p>Each guide separates diagnosis, fitment evidence, product comparison, and the costs that appear after the headline price.</p>
        </div>
        <div class="guide-grid">${guides.map((guide) => guideCard(guide)).join('')}</div>
      </section>

      <section class="shell standards-band">
        <div>
          <p class="eyebrow">How we publish</p>
          <h2>Useful evidence over blanket recommendations.</h2>
        </div>
        <div>
          <p>We do not call one brand or material universally best. Guides identify application details, tradeoffs, and reasons to pause before ordering.</p>
          <a class="text-link" href="/methodology.html">Read our methodology <span aria-hidden="true">→</span></a>
        </div>
      </section>
    </main>`

  return pageShell({
    title: 'Car Part Buying Guides',
    description: 'Independent car-part buying guides covering fitment, OEM versus aftermarket, brakes, alternators, starters, oxygen sensors, suspension, and total cost.',
    path: '/guides.html',
    body,
  })
}

function sectionMarkup(section) {
  return `<section>
    <h2>${escapeHtml(section.heading)}</h2>
    ${section.paragraphs.map((paragraph) => `<p>${textWithContactLink(paragraph)}</p>`).join('')}
  </section>`
}

function guidePage(guide) {
  const guideIndexValue = guides.findIndex((item) => item.slug === guide.slug)
  const related = [1, 2, 3]
    .map((offset) => guides[(guideIndexValue + offset) % guides.length])
    .filter((item) => item.slug !== guide.slug)

  const body = `
    <main id="main-content">
      <article class="article shell">
        ${breadcrumb([
          { label: 'Home', href: '/' },
          { label: 'Guides', href: '/guides.html' },
          { label: guide.title },
        ])}
        <header class="article-header">
          <p class="eyebrow">${escapeHtml(guide.category)}</p>
          <h1>${escapeHtml(guide.title)}</h1>
          <p class="article-dek">${escapeHtml(guide.description)}</p>
          <div class="article-meta">
            <span>Written by CarPartsRadar Editorial</span>
            <span>Reviewed ${site.updated}</span>
          </div>
        </header>

        <figure class="article-photo">
          <img src="/editorial/parts-workbench.webp" width="1440" height="960" alt="Selection of unbranded replacement car parts on a mechanic's workbench" />
        </figure>

        <div class="article-layout">
          <aside class="takeaway-box" aria-labelledby="takeaway-title">
            <p class="eyebrow" id="takeaway-title">Key takeaways</p>
            <ul>${guide.takeaways.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
          </aside>
          <div class="article-body">
            ${guide.intro.map((paragraph) => `<p class="intro">${escapeHtml(paragraph)}</p>`).join('')}
            ${guide.sections.map(sectionMarkup).join('')}
            <section class="checklist">
              <h2>Before you order</h2>
              <ol>${guide.checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>
            </section>
            <section class="sources">
              <h2>Primary references</h2>
              <p>These public sources support the vehicle-identification, safety, warranty, or consumer-rights context used in this guide.</p>
              <ul>${guide.sources.map((source) => `<li><a href="${source.url}" rel="noopener noreferrer">${escapeHtml(source.label)}</a></li>`).join('')}</ul>
            </section>
            <aside class="safety-note">
              <strong>Scope note</strong>
              <p>This guide is educational and does not diagnose a specific vehicle. Confirm the application with manufacturer service information or a qualified parts professional. Use trained help for safety-critical or unfamiliar repairs.</p>
            </aside>
          </div>
        </div>
      </article>

      <section class="related shell" aria-labelledby="related-title">
        <div class="section-heading">
          <p class="eyebrow">Continue researching</p>
          <h2 id="related-title">Related guides</h2>
        </div>
        <div class="related-grid">${related.map((item) => guideCard(item, true)).join('')}</div>
      </section>
    </main>`

  return pageShell({
    title: guide.title,
    description: guide.description,
    path: `/guides/${guide.slug}.html`,
    type: 'article',
    body,
  })
}

function standardPage(page, path) {
  const body = `
    <main id="main-content">
      <article class="standard-page shell">
        ${breadcrumb([
          { label: 'Home', href: '/' },
          { label: page.title },
        ])}
        <header>
          <p class="eyebrow">${escapeHtml(page.eyebrow)}</p>
          <h1>${escapeHtml(page.title)}</h1>
          <p class="article-dek">${textWithContactLink(page.lead)}</p>
          <p class="reviewed">Reviewed ${site.updated}</p>
        </header>
        <div class="standard-body">${page.sections.map(sectionMarkup).join('')}</div>
      </article>
    </main>`

  return pageShell({
    title: page.title,
    description: page.description,
    path,
    body,
  })
}

function sitemap() {
  const paths = [
    '/',
    '/guides.html',
    '/methodology.html',
    '/about.html',
    '/contact.html',
    '/privacy.html',
    '/terms.html',
    '/affiliate-disclosure.html',
    ...guides.map((guide) => `/guides/${guide.slug}.html`),
  ]

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((path) => `  <url><loc>${canonical(path)}</loc><lastmod>${site.isoDate}</lastmod></url>`).join('\n')}
</urlset>\n`
}

function feed() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>CarPartsRadar Buying Guides</title>
    <link>${site.origin}/guides.html</link>
    <description>Independent automotive fitment and parts-buying guidance.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date(`${site.isoDate}T12:00:00Z`).toUTCString()}</lastBuildDate>
${guides.map((guide) => `    <item>
      <title>${escapeHtml(guide.title)}</title>
      <link>${canonical(`/guides/${guide.slug}.html`)}</link>
      <guid isPermaLink="true">${canonical(`/guides/${guide.slug}.html`)}</guid>
      <description>${escapeHtml(guide.description)}</description>
      <pubDate>${new Date(`${site.isoDate}T12:00:00Z`).toUTCString()}</pubDate>
    </item>`).join('\n')}
  </channel>
</rss>\n`
}

export async function generateEditorialPages() {
  await mkdir(guideDir, { recursive: true })

  const pages = new Map([
    [resolve(publicDir, 'guides.html'), guideIndex()],
    [resolve(publicDir, 'about.html'), standardPage(trustPages.about, '/about.html')],
    [resolve(publicDir, 'methodology.html'), standardPage(trustPages.methodology, '/methodology.html')],
    [resolve(publicDir, 'contact.html'), standardPage(trustPages.contact, '/contact.html')],
    [resolve(publicDir, 'privacy.html'), standardPage(legalPages.privacy, '/privacy.html')],
    [resolve(publicDir, 'terms.html'), standardPage(legalPages.terms, '/terms.html')],
    [resolve(publicDir, 'affiliate-disclosure.html'), standardPage(legalPages.disclosure, '/affiliate-disclosure.html')],
    [resolve(publicDir, 'sitemap.xml'), sitemap()],
    [resolve(publicDir, 'feed.xml'), feed()],
    ...guides.map((guide) => [resolve(guideDir, `${guide.slug}.html`), guidePage(guide)]),
  ])

  await Promise.all([...pages].map(([path, contents]) => {
    const normalized = `${contents.replace(/[ \t]+$/gm, '').trimEnd()}\n`
    return writeFile(path, normalized, 'utf8')
  }))
  return [...pages.keys()]
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = await generateEditorialPages()
  console.log(`Generated ${output.length} editorial files.`)
}
