import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const migration = await readFile(
  new URL('../website-analytics-migration.sql', import.meta.url),
  'utf8',
)
await db.exec('create role anon; create role authenticated; create role service_role bypassrls;')
await db.exec(migration)
test.after(() => db.close())
test.beforeEach(() => db.exec('reset role; truncate public.website_analytics_events;'))
async function insert(
  session,
  name,
  properties = {},
  visitor = session,
  time = null,
  id = randomUUID(),
) {
  await db.query(
    `insert into public.website_analytics_events(event_id, session_hash, visitor_hash, event_name, properties, device, source, occurred_at)
    values($1, $2, $3, $4, $5, 'phone', 'search', coalesce($6::timestamptz, now())) on conflict(event_id) do nothing`,
    [id, session.repeat(64), visitor.repeat(64), name, JSON.stringify(properties), time],
  )
  return id
}
async function summary(days = 30) {
  return (await db.query('select public.website_analytics_summary($1) as report', [days])).rows[0]
    .report
}

test('the actual PostgreSQL migration is rerunnable and empty data stays genuinely zero', async () => {
  await db.exec(migration)
  const report = await summary(30)
  assert.equal(report.version, 1)
  assert.equal(report.totals.visits, 0)
  assert.equal(report.firstTrackedAt, null)
  assert.equal(report.daily.length, 30)
  assert.equal(
    report.daily.every((day) => day.visits === 0),
    true,
  )
  assert.deepEqual(
    report.funnel.map((step) => step.count),
    [0, 0, 0, 0, 0, 0],
  )
})
test('funnel counts each visit once and includes shared-link progress without inflating stages', async () => {
  await insert('a', 'Page Viewed', { page: 'home' })
  await insert('b', 'Page Viewed', { page: 'home' })
  await insert('b', 'Vehicle Selected')
  await insert('b', 'Search Started')
  await insert('b', 'Search Results Viewed', { hasResults: false })
  await insert('c', 'Retailer Clicked', { retailerId: 'ebay' })
  await insert('c', 'Retailer Clicked', { retailerId: 'ebay' })
  await insert('d', 'Search Started')
  await insert('d', 'Search Failed')
  const report = await summary()
  assert.deepEqual(
    report.funnel.map((step) => step.count),
    [4, 3, 3, 2, 1, 1],
  )
  assert.deepEqual(report.totals, {
    dailyVisitors: 4,
    visits: 4,
    pageviews: 2,
    searches: 2,
    retailerClicks: 2,
    engagedVisits: 3,
    storeClickVisits: 1,
    emptySearches: 1,
    failedSearches: 1,
  })
  assert.deepEqual(report.retailers, [{ key: 'ebay', count: 2 }])
  assert.deepEqual(report.devices, [{ key: 'phone', count: 4 }])
  assert.equal(JSON.stringify(report).includes('session_hash'), false)
})
test('repeat visits and repeat actions are different from daily unique visitor estimates', async () => {
  await insert('a', 'Page Viewed', { page: 'home' }, 'a')
  await insert('b', 'Page Viewed', { page: 'home' }, 'a')
  await insert('b', 'Retailer Clicked', { retailerId: 'amazon' }, 'a')
  const report = await summary()
  assert.equal(report.totals.visits, 2)
  assert.equal(report.totals.dailyVisitors, 1)
  assert.equal(report.totals.storeClickVisits, 1)
})
test('duplicate event IDs are idempotent at the database boundary', async () => {
  const id = await insert('a', 'Page Viewed', { page: 'home' })
  await insert('a', 'Page Viewed', { page: 'home' }, 'a', null, id)
  assert.equal((await summary()).totals.pageviews, 1)
})
test('calendar windows include Phoenix midnight, exclude prior/future events, and fill quiet days', async () => {
  const cutoff = (
    await db.query(
      "select (((now() at time zone 'America/Phoenix')::date - 6)::timestamp at time zone 'America/Phoenix') as at",
    )
  ).rows[0].at
  const cutoffTime = new Date(cutoff).getTime()
  await insert('a', 'Page Viewed', { page: 'home' }, 'a', new Date(cutoffTime).toISOString())
  await insert('b', 'Page Viewed', { page: 'home' }, 'b', new Date(cutoffTime - 1).toISOString())
  await insert(
    'c',
    'Page Viewed',
    { page: 'home' },
    'c',
    new Date(Date.now() + 86400000).toISOString(),
  )
  const report = await summary(7)
  assert.equal(report.totals.visits, 1)
  assert.equal(report.daily.length, 7)
  assert.equal(report.daily[0].visits, 1)
  assert.equal(
    report.daily.slice(1).every((day) => day.visits === 0),
    true,
  )
  assert.equal((await summary(30)).totals.visits, 2)
})
test('anonymous and shopper roles cannot read event rows or call the owner aggregate RPC', async () => {
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`)
    await assert.rejects(
      db.query('select * from public.website_analytics_events'),
      /permission denied/,
    )
    await assert.rejects(
      db.query('select public.website_analytics_summary(30)'),
      /permission denied/,
    )
    await db.exec('reset role')
  }
  await db.exec('set role service_role')
  await insert('a', 'Page Viewed', { page: 'home' })
  assert.equal((await summary()).version, 1)
  await db.exec('reset role')
})
test('invalid report periods and unsafe event names fail at the SQL boundary', async () => {
  await assert.rejects(summary(1000), /invalid analytics period/)
  await assert.rejects(insert('a', 'customer-email'), /check constraint/)
})
