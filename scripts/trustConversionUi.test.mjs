import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('comparison and detail views keep marketplace fitment language cautious and evidence-backed', async () => {
  const [comparison, detail] = await Promise.all([
    readSource('src/components/ComparisonModal.tsx'),
    readSource('src/components/PartDetailModal.tsx'),
  ])

  assert.equal(comparison.includes(['Verified', 'Fitment'].join(' ')), false)
  assert.match(comparison, /Marketplace compatibility match/)
  assert.match(comparison, /Scope:/)
  assert.match(comparison, /Provider:/)
  assert.match(comparison, /Checked:/)
  assert.match(comparison, /Marketplace data can omit engine/)
  assert.match(detail, /Scope/)
  assert.match(detail, /Provider/)
  assert.match(detail, /Checked/)
  assert.match(detail, /not a fitment guarantee/)
})

test('save-search auth guidance is actionable and distinct from save errors', async () => {
  const results = await readSource('src/components/ResultsList.tsx')

  assert.match(results, /Sign in or create an account to save this search/)
  assert.match(results, /onClick=\{onOpenAccount\}/)
  assert.match(results, /Couldn't save/)
  assert.match(results, /if \(!isAuth\) setTimeout/)
})

test('revenue funnel events cover retailer clicks and price-alert creation without collecting email addresses', async () => {
  const [analytics, listing, results, alerts, disclosure, detail, watchlist, publicDisclosure] = await Promise.all([
    readSource('src/lib/analytics.ts'),
    readSource('src/components/ListingCard.tsx'),
    readSource('src/components/ResultsList.tsx'),
    readSource('src/components/PriceAlertCard.tsx'),
    readSource('src/components/AffiliateDisclosure.tsx'),
    readSource('src/components/PartDetailModal.tsx'),
    readSource('src/components/CartPanel.tsx'),
    readSource('public/affiliate-disclosure.html'),
  ])

  assert.match(analytics, /Retailer Clicked/)
  assert.match(analytics, /placement/)
  assert.match(listing, /onClick=\{onOutboundClick\}/)
  assert.match(results, /trackRetailerClick/)
  assert.match(results, /Search Results Viewed/)
  assert.match(results, /store-comparison/)
  assert.match(alerts, /Price Alert Created/)
  assert.doesNotMatch(alerts, /trackEvent\([^\n]*email/)
  assert.match(disclosure, /As an Amazon Associate I earn from qualifying purchases/)
  assert.match(publicDisclosure, /As an Amazon Associate I earn from qualifying purchases/)
  assert.match(disclosure, /As an eBay Partner/)
  assert.match(detail, /listing-detail/)
  assert.match(watchlist, /watchlist-compare/)
})

test('generic vehicle health excludes engine-specific timing-belt guidance', async () => {
  const [schedule, healthModal] = await Promise.all([
    readSource('src/data/maintenanceSchedule.ts'),
    readSource('src/components/VehicleHealthModal.tsx'),
  ])

  assert.match(schedule, /part: 'Timing Belt'.*engineSpecific: true/)
  assert.match(schedule, /hasConfirmedEngine \|\| !m\.engineSpecific/)
  assert.match(healthModal, /Engine-specific services are omitted/)
  assert.match(healthModal, /owner's manual controls/)
})
