// Mobile verification driver. Drives the dev server in Edge (via
// puppeteer-core) through the full search flow at mobile + desktop
// viewports, asserts layout/touch-target invariants, and captures
// screenshots as evidence in ./shots (gitignored).
//
// Run:
//   npm run dev:all
//   BASE_URL=http://localhost:<vite port> node drive-mobile.mjs
// BASE_URL defaults to http://localhost:5173.
import puppeteer from 'puppeteer-core'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL || 'http://localhost:5173'
const SHOTS = process.env.SHOTS_DIR || './shots'
await mkdir(SHOTS, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-first-run', '--disable-gpu'],
})

const results = []
const consoleErrors = []
const page = await browser.newPage()
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300))
})
page.setDefaultTimeout(20000)

const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png` })
const step = async (name, fn) => {
  try {
    const note = await fn()
    results.push(`OK ${name}${note ? ' — ' + note : ''}`)
  } catch (e) {
    results.push(`FAIL ${name} — ${String(e.message || e).slice(0, 200)}`)
    await shot(`FAIL-${name.replace(/[^a-z0-9-]/gi, '_')}`).catch(() => {})
  }
}

// Click the first element whose visible text matches, within optional scope selector.
const clickText = async (text, scope = 'body') => {
  const clicked = await page.evaluate(
    (text, scope) => {
      const root = document.querySelector(scope)
      if (!root) return false
      const els = [...root.querySelectorAll('button, a, [role="option"], label, span, div')]
      const el = els.find((e) => e.childElementCount === 0
        ? e.textContent.trim() === text
        : e.textContent.trim() === text && (e.tagName === 'BUTTON' || e.tagName === 'A'))
        || els.find((e) => e.textContent.trim() === text)
      if (!el) return false
      const target = el.closest('button, a, [role="option"], label') || el
      target.click()
      return true
    },
    text,
    scope
  )
  if (!clicked) throw new Error(`clickText: "${text}" not found`)
}

// innerText reflects text-transform (hero/eyebrows render uppercase), so
// match case-insensitively.
const waitForText = (text) =>
  page.waitForFunction(
    (t) => document.body.innerText.toLowerCase().includes(t.toLowerCase()),
    { timeout: 25000 },
    text
  )

// ---------- Mobile 375x667 (iPhone SE) ----------
await page.setViewport({ width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await page.goto(`${BASE}/`, { waitUntil: 'load' })

await step('se-home-renders', async () => {
  await waitForText('Parts that fit')
  await shot('01-se-home')
})

await step('se-bottom-nav-present', async () => {
  const nav = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Primary"]')
    if (!nav) return null
    const r = nav.getBoundingClientRect()
    const labels = [...nav.querySelectorAll('button')].map((b) => b.textContent.trim())
    return { bottom: r.bottom, height: r.height, labels, visible: getComputedStyle(nav).display !== 'none' }
  })
  if (!nav || !nav.visible) throw new Error('bottom nav missing/hidden')
  if (nav.labels.join(',') !== 'Search,Watchlist,Account') throw new Error('labels: ' + nav.labels.join(','))
  return `h=${nav.height}px labels ok`
})

await step('se-header-slim', async () => {
  const hidden = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('header button')]
    const watch = btns.find((b) => b.getAttribute('aria-label') === 'Open watchlist')
    const acct = btns.find((b) => b.getAttribute('aria-label') === 'Open account')
    return {
      watch: watch ? getComputedStyle(watch).display : 'gone',
      acct: acct ? getComputedStyle(acct).display : 'gone',
    }
  })
  if (hidden.watch !== 'none' || hidden.acct !== 'none') throw new Error(JSON.stringify(hidden))
  return 'watchlist/account hidden in header'
})

await step('se-input-font-16px', async () => {
  // CarSelector mounts after the shared lazy chunk loads — wait for it.
  await page.waitForSelector('input[placeholder="Select year"]')
  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll('.field')].slice(0, 3).map((i) => getComputedStyle(i).fontSize)
  )
  if (!sizes.length || sizes.some((s) => parseFloat(s) < 16)) throw new Error('field sizes: ' + sizes.join(','))
  return sizes.join(',')
})

await step('se-select-vehicle', async () => {
  // Year
  await page.waitForSelector('input[placeholder="Select year"]')
  await page.click('input[placeholder="Select year"]')
  await page.waitForSelector('[role="listbox"]')
  await clickText('2015')
  // Make — type to filter live NHTSA list
  await page.click('input[placeholder="Select make"]')
  await page.type('input[placeholder="Select make"]', 'Toyota')
  await page.waitForFunction(() => document.querySelector('[role="listbox"]')?.innerText.toLowerCase().includes('toyota'))
  await page.evaluate(() => {
    const opts = [...document.querySelectorAll('[role="option"]')]
    opts.find((o) => o.textContent.trim().toLowerCase() === 'toyota')?.click()
  })
  // Model — wait for live fetch; keep the handle since the placeholder
  // attribute flips while models load and a re-query can race it.
  const modelInput = await page.waitForSelector('input[placeholder="Select model"]:not([disabled])', { timeout: 25000 })
  await modelInput.click()
  await modelInput.type('Camry')
  await page.waitForFunction(() => document.querySelector('[role="listbox"]')?.innerText.toLowerCase().includes('camry'))
  await page.evaluate(() => {
    const opts = [...document.querySelectorAll('[role="option"]')]
    opts.find((o) => o.textContent.trim().toLowerCase() === 'camry')?.click()
  })
  await waitForText('Fitment lock')
  await shot('02-se-vehicle-selected')
})

await step('se-sticky-cta', async () => {
  const cta = await page.evaluate(() => {
    const bars = [...document.querySelectorAll('div')].filter((d) =>
      d.className.includes && String(d.className).includes('bottom-[calc(3.5rem')
    )
    if (!bars.length) return null
    const r = bars[0].getBoundingClientRect()
    return { top: r.top, visible: getComputedStyle(bars[0]).display !== 'none', text: bars[0].innerText.trim() }
  })
  if (!cta || !cta.visible || !cta.text.includes('Continue to parts')) throw new Error(JSON.stringify(cta))
  return `sticky CTA at y=${Math.round(cta.top)}`
})

await step('se-goto-parts', async () => {
  // Tap the sticky CTA (last "Continue to parts" button on the page)
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')].filter((b) => b.innerText.includes('Continue to parts'))
    btns[btns.length - 1].click()
  })
  await waitForText('What part do you need?')
  await shot('03-se-part-step')
})

await step('se-tabs-scrollable', async () => {
  const t = await page.evaluate(() => {
    const tab = [...document.querySelectorAll('button.tab, button[class*="tab"]')].find((b) => b.innerText === 'Part Name')
    const row = tab?.parentElement
    if (!row) return null
    return { scrollW: row.scrollWidth, clientW: row.clientWidth, tabH: tab.getBoundingClientRect().height }
  })
  if (!t) throw new Error('tab row not found')
  if (t.scrollW <= t.clientW) throw new Error(`not scrollable: ${t.scrollW}<=${t.clientW}`)
  if (t.tabH < 40) throw new Error(`tab height ${t.tabH}`)
  return `scrollW=${t.scrollW} clientW=${t.clientW} tabH=${Math.round(t.tabH)}`
})

await step('se-search-brake-pads', async () => {
  await clickText('Brake Pads')
  await waitForText('Live eBay listings')
  // wait for skeletons to resolve into cards or empty state
  await page.waitForFunction(() => !document.body.innerText.includes('Scanning live listings'), { timeout: 30000 })
  await shot('04-se-results')
})

await step('se-mobile-toolbar', async () => {
  const t = await page.evaluate(() => {
    const filterBtn = [...document.querySelectorAll('button')].find((b) => b.innerText.trim().startsWith('Filters'))
    if (!filterBtn) return null
    const r = filterBtn.getBoundingClientRect()
    return { h: r.height, visible: r.height > 0 }
  })
  if (!t || !t.visible || t.h < 44) throw new Error(JSON.stringify(t))
  return `Filters btn h=${Math.round(t.h)}`
})

await step('se-filter-sheet', async () => {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((b) => b.innerText.trim().startsWith('Filters'))
    b.click()
  })
  await waitForText('Hide overseas listings')
  await shot('05-se-filter-sheet')
  // toggle hide overseas
  await page.evaluate(() => {
    const lbl = [...document.querySelectorAll('label')].find((l) => l.innerText.includes('Hide overseas'))
    lbl.querySelector('input').click()
  })
  await clickText('Show results')
  await page.waitForFunction(() => !document.body.innerText.includes('Minimum seller rating'), { timeout: 10000 })
  const badge = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((b) => b.innerText.trim().startsWith('Filters'))
    return b?.innerText.replace(/\s+/g, ' ')
  })
  if (!badge.includes('1')) throw new Error('filter badge not showing: ' + badge)
  return 'sheet opened, toggled overseas, badge=1'
})

await step('se-listing-actions', async () => {
  const info = await page.evaluate(() => {
    const buy = [...document.querySelectorAll('a')].find((a) => a.innerText.includes('Buy on'))
    const watch = [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Watch')
    const detail = [...document.querySelectorAll('button')].find((b) => b.innerText.trim().startsWith('Details'))
    const detailView = [...document.querySelectorAll('button')].find((b) => b.innerText.includes('Click for Detailed View'))
    return {
      buyH: buy?.getBoundingClientRect().height,
      watchH: watch?.getBoundingClientRect().height,
      hasDetails: !!detail,
      detailViewHidden: detailView ? getComputedStyle(detailView).display === 'none' : 'absent',
    }
  })
  if (!info.buyH || info.buyH < 44) throw new Error('buy height: ' + info.buyH)
  if (!info.watchH || info.watchH < 44) throw new Error('watch height: ' + info.watchH)
  if (!info.hasDetails) throw new Error('no Details affordance')
  if (info.detailViewHidden !== true && info.detailViewHidden !== 'absent') throw new Error('desktop detail btn visible')
  return `buy=${Math.round(info.buyH)} watch=${Math.round(info.watchH)}`
})

await step('se-detail-sheet', async () => {
  await page.evaluate(() => {
    const d = [...document.querySelectorAll('button')].find((b) => b.innerText.trim().startsWith('Details'))
    d.click()
  })
  await page.waitForSelector('[data-vaul-drawer]', { timeout: 10000 })
  await new Promise((r) => setTimeout(r, 600))
  await shot('06-se-detail-sheet')
  const footer = await page.evaluate(() => {
    const w = [...document.querySelectorAll('[data-vaul-drawer] button, [data-vaul-drawer] a')]
      .find((b) => b.innerText.includes('View on') || b.innerText.includes('Add to Watchlist'))
    return !!w
  })
  if (!footer) throw new Error('sheet footer actions missing')
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('[data-vaul-drawer]'), { timeout: 10000 })
  return 'sheet opened with actions, Escape dismissed'
})

await step('se-watch-and-tab', async () => {
  await page.evaluate(() => {
    const w = [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Watch')
    w.click()
  })
  await new Promise((r) => setTimeout(r, 400))
  // badge on bottom nav
  const badge = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Primary"]')
    return nav.innerText.replace(/\s+/g, ' ')
  })
  if (!/1/.test(badge)) throw new Error('nav badge missing: ' + badge)
  await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Primary"]')
    ;[...nav.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes('watchlist')).click()
  })
  await waitForText('Total of watched items')
  await shot('07-se-watchlist')
  return 'watch added, badge=1, watchlist view ok'
})

await step('se-account-tab', async () => {
  await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Primary"]')
    ;[...nav.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes('account')).click()
  })
  await waitForText('Continue with Google')
  await shot('08-se-account')
})

await step('se-search-tab-restores', async () => {
  await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Primary"]')
    ;[...nav.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes('search')).click()
  })
  await waitForText('Live eBay listings')
  return 'returned to results from account'
})

await step('se-compare-bar-position', async () => {
  await page.evaluate(() => {
    const c = [...document.querySelectorAll('button')].filter((b) => b.innerText.trim() === 'Compare')
    c[0].click()
    c[1]?.click()
  })
  await new Promise((r) => setTimeout(r, 500))
  const pos = await page.evaluate(() => {
    // filter + last: querySelectorAll is document order, so the last match
    // is the innermost div (the bar itself), not a page-level ancestor.
    const bar = [...document.querySelectorAll('div')].filter((d) => d.innerText.includes('selected to compare')).pop()
    if (!bar) return null
    const barR = bar.getBoundingClientRect()
    const nav = document.querySelector('nav[aria-label="Primary"]').getBoundingClientRect()
    return { barBottom: barR.bottom, navTop: nav.top }
  })
  if (!pos) throw new Error('compare bar missing')
  if (pos.barBottom > pos.navTop + 1) throw new Error(`overlaps nav: bar ${pos.barBottom} vs nav ${pos.navTop}`)
  await shot('09-se-compare-bar')
  return `bar bottom ${Math.round(pos.barBottom)} above nav top ${Math.round(pos.navTop)}`
})

await step('se-dark-mode', async () => {
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('header button')].find((b) => b.getAttribute('aria-label') === 'Toggle theme')
    t.click()
  })
  await new Promise((r) => setTimeout(r, 400))
  await shot('10-se-dark')
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('header button')].find((b) => b.getAttribute('aria-label') === 'Toggle theme')
    t.click()
  })
})

// ---------- 393x852 and 430x932 spot checks ----------
for (const [w, h, tag] of [[393, 852, '15pro'], [430, 932, 'promax']]) {
  await step(`${tag}-home`, async () => {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    await page.goto(`${BASE}/`, { waitUntil: 'load' })
    await waitForText('Parts that fit')
    const nav = await page.evaluate(() => !!document.querySelector('nav[aria-label="Primary"]'))
    if (!nav) throw new Error('no bottom nav')
    await shot(`11-${tag}-home`)
  })
}

// ---------- Desktop regression 1280x900 ----------
await step('desktop-regression', async () => {
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false })
  await page.goto(`${BASE}/?step=results&year=2015&make=Toyota&model=Camry&part=Brake%20Pads`, { waitUntil: 'load' })
  await waitForText('Live eBay listings')
  await page.waitForFunction(() => !document.body.innerText.includes('Scanning live listings'), { timeout: 30000 })
  const d = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Primary"]')
    const navHidden = !nav || getComputedStyle(nav).display === 'none'
    const watch = [...document.querySelectorAll('header button')].find((b) => b.getAttribute('aria-label') === 'Open watchlist')
    const filterBtn = [...document.querySelectorAll('button')].find((b) => b.innerText.trim().startsWith('Filters'))
    const filterHidden = !filterBtn || filterBtn.getBoundingClientRect().height === 0
    const detailView = [...document.querySelectorAll('button')].find((b) => b.innerText.includes('Click for Detailed View'))
    const minRating = document.body.innerText.includes('Min rating')
    return {
      navHidden,
      headerWatchVisible: watch && getComputedStyle(watch).display !== 'none',
      filterHidden,
      detailViewVisible: detailView && getComputedStyle(detailView).display !== 'none',
      minRating,
    }
  })
  if (!d.navHidden) throw new Error('bottom nav visible on desktop')
  if (!d.headerWatchVisible) throw new Error('header watchlist missing on desktop')
  if (!d.filterHidden) throw new Error('mobile Filters button visible on desktop')
  if (!d.detailViewVisible) throw new Error('desktop detail button missing')
  if (!d.minRating) throw new Error('desktop toolbar (Min rating) missing')
  await shot('12-desktop-results')
  return 'desktop intact: no tab bar, header buttons back, desktop toolbar'
})

await step('manifest-served', async () => {
  const res = await page.evaluate(async () => {
    const r = await fetch('/manifest.webmanifest')
    const j = await r.json()
    return { status: r.status, name: j.name, icons: j.icons.length }
  })
  if (res.status !== 200 || res.name !== 'CarPartsRadar' || res.icons !== 3) throw new Error(JSON.stringify(res))
  return `manifest 200, ${res.icons} icons`
})

await browser.close()
console.log('\n=== RESULTS ===')
for (const r of results) console.log(r)
console.log('\n=== CONSOLE ERRORS (first 10) ===')
for (const e of consoleErrors.slice(0, 10)) console.log(e)
if (!consoleErrors.length) console.log('(none)')
