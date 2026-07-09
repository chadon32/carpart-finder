# Growth Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (inline execution; do not spawn subagents unless the user asks). Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **First action after approval:** copy this plan to `docs/superpowers/plans/2026-07-08-growth-features.md` and commit it (plan mode blocked repo writes during planning).

**Context:** Spec at `docs/superpowers/specs/2026-07-08-growth-features-design.md` (committed, user-approved: "do all requested besides serpai"). CarPartsRadar monetizes eBay live listings + retailer deep links; eBay clicks are currently un-tagged (revenue leak), sessions are single-search (no job bundling), the garage is a re-select shortcut, and there is no honest price-history data. These five features fix that: EPN affiliate tagging, "Complete the Job" companions, VIN decode, garage Vehicle Health (NHTSA recalls + typical-maintenance reference), and real observed price history.

**Goal:** Ship all five features with tests, per-feature commits, everything gated behind env vars / fail-closed guards so nothing breaks while Supabase/Resend/EPN accounts remain unconfigured.

**Architecture:** All server logic lives in `server/*.js`, exposed through the single Express app `api/index.js` (deployed as one Vercel function; local dev via `server/index.js`). New NHTSA calls (VIN, recalls) mirror the existing `server/nhtsa.js` cache+promise-dedupe pattern over `fetchWithRetry`. Price history writes go through a never-throws recorder guarded by `accountsAvailable && supabaseAdmin`. Frontend is Vite+React 19+TS+Tailwind v4 using existing design tokens (`card`, `btn btn-*`, `eyebrow`, `font-data`, `field`, `icon-tile`).

**Tech Stack:** Node 24 (`node --test`), Express 5, Supabase JS, React 19, Tailwind v4, lucide-react, sonner, PostHog.

## Global Constraints

- **Honesty guardrail:** no fabricated listings/prices/trends; no "due for service" math; estimates labeled "typical"; sparkline only from real observations (≥5).
- **Fail-closed:** anything Supabase-touching guards on `accountsAvailable && supabaseAdmin` and no-ops/returns empty otherwise. Never re-infer mock mode from missing config.
- **No new npm dependencies.** Resend/NHTSA/eBay via `fetch`/`fetchWithRetry` only.
- **Tests:** `npm test` = `node --test "server/**/*.test.js" "api/**/*.test.js"` — always quote globs (Windows). Set env vars BEFORE `await import('../api/index.js')` (config resolves at import time). One test file per env scenario (module cache). Test fetch-stubs MUST pass through non-upstream URLs (tests call the local server via fetch).
- **Tailwind v4:** never `@apply` a custom component class inside another; compose variants in markup (`className="btn btn-secondary"`).
- **Copy rules (exact strings where they carry the honesty contract):** maintenance header label `Typical intervals — always check your owner's manual.`; recalls empty state `No open recalls found in the NHTSA database`.
- **Commits:** sentence-case imperative subject (repo style, no `feat:` prefixes), trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Commit after each task. Never `--no-verify`.
- **Verification per frontend task:** `npm run lint` and `npm run build` must pass (no frontend test runner exists — deliberate).
- **Do not kill any running dev server on port 3001** (may be the user's). Use `PORT=3111` for manual smoke tests.

---

### Task 1: EPN affiliate tagging (server + disclosure)

**Files:**
- Modify: `server/providers/ebay.js` (runSearch headers ~line 69-77; mapItem ~line 98-127)
- Modify: `server/.env.example` (append)
- Modify: `src/App.tsx` (footer disclosure ~line 266-269)
- Test: `server/providers/ebay.test.js` (create)

**Interfaces:**
- Consumes: existing `runSearch`/`mapItem` internals of `server/providers/ebay.js`.
- Produces: named exports `buildEndUserCtx({ zip, campaignId }) → string | undefined` and `mapItem(item, { verifiedFitment }) → listing` (mapItem newly exported for tests; behavior change: `link` prefers `itemAffiliateWebUrl`).

- [ ] **Step 1: Write the failing test** — create `server/providers/ebay.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildEndUserCtx, mapItem } from './ebay.js'

test('buildEndUserCtx with campaign and zip joins with a comma, campaign first', () => {
  assert.equal(
    buildEndUserCtx({ zip: '30301', campaignId: '5339012345' }),
    `affiliateCampaignId=5339012345,contextualLocation=${encodeURIComponent('country=US,zip=30301')}`
  )
})

test('buildEndUserCtx with only zip matches the legacy header exactly', () => {
  assert.equal(
    buildEndUserCtx({ zip: '30301' }),
    `contextualLocation=${encodeURIComponent('country=US,zip=30301')}`
  )
})

test('buildEndUserCtx with only campaign id', () => {
  assert.equal(buildEndUserCtx({ campaignId: '5339012345' }), 'affiliateCampaignId=5339012345')
})

test('buildEndUserCtx with neither returns undefined', () => {
  assert.equal(buildEndUserCtx({}), undefined)
  assert.equal(buildEndUserCtx(), undefined)
})

const baseItem = {
  itemId: '123',
  title: 'Brake Pads',
  itemWebUrl: 'https://www.ebay.com/itm/123',
  price: { value: '25.00', currency: 'USD' },
}

test('mapItem prefers itemAffiliateWebUrl when present', () => {
  const mapped = mapItem(
    { ...baseItem, itemAffiliateWebUrl: 'https://www.ebay.com/itm/123?mkcid=1&campid=5339012345' },
    { verifiedFitment: true }
  )
  assert.equal(mapped.link, 'https://www.ebay.com/itm/123?mkcid=1&campid=5339012345')
})

test('mapItem falls back to itemWebUrl when no affiliate url exists', () => {
  const mapped = mapItem(baseItem, { verifiedFitment: false })
  assert.equal(mapped.link, 'https://www.ebay.com/itm/123')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run (Bash tool): `cd "C:/Users/chado/Documents/car part finder" && node --test "server/providers/ebay.test.js"`
Expected: FAIL — `buildEndUserCtx` / `mapItem` are not exported (SyntaxError: named export not found).

- [ ] **Step 3: Implement in `server/providers/ebay.js`**

Add above `runSearch` (after the `BASE_FILTER` const):

```js
// X-EBAY-C-ENDUSERCTX carries comma-separated context params. affiliateCampaignId
// is the EPN (eBay Partner Network) campaign — when present, eBay returns
// itemAffiliateWebUrl and clicks become commissionable. contextualLocation makes
// shipping costs/dates accurate for the buyer's ZIP. Exported for tests.
export function buildEndUserCtx({ zip, campaignId } = {}) {
  const parts = []
  if (campaignId) parts.push(`affiliateCampaignId=${campaignId}`)
  if (zip) parts.push(`contextualLocation=${encodeURIComponent(`country=US,zip=${zip}`)}`)
  return parts.length > 0 ? parts.join(',') : undefined
}
```

Replace the existing zip-header block inside `runSearch`:

```js
  // Buyer ZIP makes eBay return location-accurate shipping cost + delivery dates.
  // The header value must be URL-encoded or eBay ignores the location.
  if (zip) {
    headers['X-EBAY-C-ENDUSERCTX'] = `contextualLocation=${encodeURIComponent(`country=US,zip=${zip}`)}`
  }
```

with:

```js
  // EPN campaign id is read at call time so a config change doesn't require
  // a code change, and tests can exercise the pure builder directly.
  const endUserCtx = buildEndUserCtx({ zip, campaignId: process.env.EBAY_EPN_CAMPAIGN_ID })
  if (endUserCtx) {
    headers['X-EBAY-C-ENDUSERCTX'] = endUserCtx
  }
```

Change `function mapItem(item, { verifiedFitment })` to `export function mapItem(item, { verifiedFitment })`, and inside it change `link: item.itemWebUrl,` to:

```js
    link: item.itemAffiliateWebUrl || item.itemWebUrl,
```

(`isValidItem` keeps requiring `itemWebUrl` — the affiliate URL is a bonus, not a validity signal.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "C:/Users/chado/Documents/car part finder" && node --test "server/providers/ebay.test.js"`
Expected: PASS (6 tests). Then run the full suite: `npm test` — all pass.

- [ ] **Step 5: Append to `server/.env.example`**

```
# Optional: eBay Partner Network campaign id (https://partnernetwork.ebay.com).
# When set, live eBay listings link through commissionable affiliate URLs.
# Without it, plain item links are used and nothing else changes.
EBAY_EPN_CAMPAIGN_ID=your-epn-campaign-id
```

- [ ] **Step 6: Update the footer disclosure in `src/App.tsx`**

In the footer paragraph that begins `Affiliate disclosure:`, change the last sentence:

```
                you make a purchase — at no extra cost to you. As an Amazon Associate, CarPartsRadar earns from
                qualifying purchases.
```

to:

```
                you make a purchase — at no extra cost to you. As an Amazon Associate, CarPartsRadar earns from
                qualifying purchases. CarPartsRadar is also a member of the eBay Partner Network.
```

- [ ] **Step 7: Verify frontend still builds**

Run: `npm run lint && npm run build`
Expected: both exit 0.

- [ ] **Step 8: Commit**

```bash
git add server/providers/ebay.js server/providers/ebay.test.js server/.env.example src/App.tsx
git commit -m "Tag eBay listings with EPN affiliate context when configured"
```

---

### Task 2: Companion parts data (`partTypes.ts`)

**Files:**
- Modify: `src/data/partTypes.ts`

**Interfaces:**
- Produces: `PartType.companions?: string[]`; `companionsForPart(part: string, isElectric: boolean): string[]` (case-insensitive part lookup; returns `[]` for unknown/free-text parts; filters EV-incompatible companions via existing `partTypesForVehicle`).

- [ ] **Step 1: Extend the type and data**

In `src/data/partTypes.ts`, add to `PartType`:

```ts
export type PartType = {
  name: string
  popular: boolean
  // Parts tagged 'ice' require a combustion engine and don't exist on
  // battery-electric vehicles (spark plugs, oil filter, muffler, etc).
  // Untagged (or 'all') parts apply to every powertrain.
  powertrain?: 'ice'
  // Parts commonly replaced in the same job. Names must exactly match another
  // entry's `name` — companions run through the same category mapping and
  // powertrain filter as a hand-picked search.
  companions?: string[]
}
```

Then add `companions` to these entries (leave every other entry untouched — parts with no natural companion get none):

```ts
  { name: 'Brake Pads', popular: true, companions: ['Brake Rotors'] },
  { name: 'Brake Rotors', popular: true, companions: ['Brake Pads'] },
  { name: 'Oil Filter', popular: true, powertrain: 'ice', companions: ['Air Filter', 'Cabin Air Filter'] },
  { name: 'Air Filter', popular: true, powertrain: 'ice', companions: ['Cabin Air Filter', 'Oil Filter'] },
  { name: 'Cabin Air Filter', popular: false, companions: ['Air Filter'] },
  { name: 'Battery', popular: true, companions: ['Alternator'] },
  { name: 'Spark Plugs', popular: true, powertrain: 'ice', companions: ['Ignition Coil'] },
  { name: 'Coolant', popular: false, companions: ['Thermostat'] },
  { name: 'Alternator', popular: false, powertrain: 'ice', companions: ['Serpentine Belt', 'Battery'] },
  { name: 'Starter', popular: false, powertrain: 'ice', companions: ['Battery'] },
  { name: 'Radiator', popular: false, powertrain: 'ice', companions: ['Coolant', 'Thermostat'] },
  { name: 'Water Pump', popular: false, powertrain: 'ice', companions: ['Timing Belt', 'Coolant', 'Thermostat'] },
  { name: 'Timing Belt', popular: false, powertrain: 'ice', companions: ['Water Pump', 'Coolant'] },
  { name: 'Serpentine Belt', popular: false, powertrain: 'ice', companions: ['Alternator', 'Water Pump'] },
  { name: 'Shocks and Struts', popular: false, companions: ['Control Arm'] },
  { name: 'CV Axle', popular: false, companions: ['Wheel Bearing'] },
  { name: 'Fuel Pump', popular: false, powertrain: 'ice', companions: ['Fuel Injector'] },
  { name: 'Oxygen Sensor', popular: false, powertrain: 'ice', companions: ['Catalytic Converter'] },
  { name: 'Catalytic Converter', popular: false, powertrain: 'ice', companions: ['Oxygen Sensor', 'Muffler'] },
  { name: 'Muffler', popular: false, powertrain: 'ice', companions: ['Catalytic Converter'] },
  { name: 'Outer Tie Rods', popular: false, companions: ['Tie Rod Ends', 'Control Arm'] },
  { name: 'Tie Rod Ends', popular: false, companions: ['Outer Tie Rods', 'Control Arm'] },
  { name: 'Control Arm', popular: false, companions: ['Outer Tie Rods', 'Shocks and Struts'] },
  { name: 'Thermostat', popular: false, powertrain: 'ice', companions: ['Coolant', 'Radiator'] },
  { name: 'Ignition Coil', popular: false, powertrain: 'ice', companions: ['Spark Plugs'] },
  { name: 'Wheel Bearing', popular: false, companions: ['CV Axle', 'Brake Rotors'] },
  { name: 'Fuel Injector', popular: false, powertrain: 'ice', companions: ['Fuel Pump', 'Spark Plugs'] },
  { name: 'Mass Air Flow Sensor', popular: false, powertrain: 'ice', companions: ['Air Filter'] },
```

- [ ] **Step 2: Add the resolver + dev-time integrity check** (append at the end of the file):

```ts
// Companions for a part, EV-filtered the same way the part grid is. Unknown
// part names (free-text searches) simply return [] — never a fabricated list.
export function companionsForPart(part: string, isElectric: boolean): string[] {
  const target = part.trim().toLowerCase()
  const entry = partTypes.find((p) => p.name.toLowerCase() === target)
  if (!entry?.companions) return []
  const allowed = new Set(partTypesForVehicle(isElectric).map((p) => p.name))
  return entry.companions.filter((name) => allowed.has(name))
}

// Cross-reference integrity: every companion must name a real part type, or it
// silently produces a broken search category. Warn loudly in dev, never throw.
if (import.meta.env.DEV) {
  const names = new Set(partTypes.map((p) => p.name))
  for (const p of partTypes) {
    for (const c of p.companions ?? []) {
      if (!names.has(c)) console.warn(`[partTypes] "${p.name}" lists unknown companion "${c}"`)
    }
  }
}
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build`
Expected: exit 0 (build proves every companion string type-checks and `import.meta.env` resolves under Vite).

- [ ] **Step 4: Commit**

```bash
git add src/data/partTypes.ts
git commit -m "Add companion-part data and EV-aware resolver to part types"
```

---

### Task 3: "Complete the Job" UI (ResultsList + PartDetailModal + App wiring)

**Files:**
- Modify: `src/components/ResultsList.tsx` (props ~line 48-62; aside ~line 550; PartDetailModal render ~line 592-606)
- Modify: `src/components/PartDetailModal.tsx` (props ~line 11-27; details column ~line 111)
- Modify: `src/App.tsx` (ResultsList render ~line 230-243)

**Interfaces:**
- Consumes: `companionsForPart(part, isElectric)` from Task 2; `isElectricVehicle(make, model)` from `src/data/electricVehicles.ts`; `trackEvent` from `src/lib/analytics.ts`.
- Produces: `ResultsList` prop `onSearchPart?: (part: string) => void`; `PartDetailModal` props `companions?: string[]`, `onSearchPart?: (part: string) => void`.

- [ ] **Step 1: ResultsList — accept the prop and compute companions**

Add imports:

```ts
import { companionsForPart } from '../data/partTypes'
import { isElectricVehicle } from '../data/electricVehicles'
import { trackEvent } from '../lib/analytics'
```

Add `onSearchPart` to the props (after `isInWatchlist`):

```ts
  onAddToWatchlist: (listing: Listing) => void
  isInWatchlist: (listingId: string) => boolean
  onSearchPart?: (part: string) => void
```

(and to the destructured parameters). Below the `bestPrice` memo add:

```ts
  const companions = useMemo(
    () => companionsForPart(part, isElectricVehicle(car.make, car.model)),
    [part, car.make, car.model]
  )

  const searchCompanion = (to: string, location: 'results-aside' | 'detail-modal') => {
    if (!onSearchPart) return
    trackEvent('Companion Part Clicked', { from: part, to, location, vehicleString: vehicleLabel })
    setSelectedListing(null)
    onSearchPart(to)
  }
```

(`searchCompanion` must be declared after `vehicleLabel`; place it directly above the `return`.)

- [ ] **Step 2: ResultsList — render the aside card**

Inside `<aside className="md:col-span-5 xl:col-span-4 space-y-6">`, ABOVE the existing "Compare at other stores" card, add:

```tsx
              {companions.length > 0 && onSearchPart && (
                <div className="card p-6">
                  <div className="flex items-center gap-3">
                    <div className="icon-tile bg-brand-600 text-white"><Wrench size={17} /></div>
                    <div>
                      <div className="font-semibold tracking-tight text-slate-950">Complete the job</div>
                      <div className="text-xs text-slate-500">Commonly replaced together — searches your {car.year} {car.make} {car.model}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {companions.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => searchCompanion(c, 'results-aside')}
                        className="btn btn-secondary px-3.5 py-2 text-xs"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
```

(`Wrench` is already imported in ResultsList.)

- [ ] **Step 3: PartDetailModal — optional chips**

Add props to `PartDetailModalProps`:

```ts
  companions?: string[]
  onSearchPart?: (part: string) => void
```

(and destructure them). In the details column, directly ABOVE the `{/* AI Repair Guide Section */}` block, add:

```tsx
            {companions && companions.length > 0 && onSearchPart && (
              <div className="mt-5">
                <div className="eyebrow">Complete the job</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {companions.map((c) => (
                    <button key={c} type="button" onClick={() => onSearchPart(c)} className="btn btn-secondary px-3 py-1.5 text-xs">
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}
```

- [ ] **Step 4: Wire the modal + App**

In ResultsList's `<PartDetailModal ... />` render, add:

```tsx
            companions={companions}
            onSearchPart={onSearchPart ? (p) => searchCompanion(p, 'detail-modal') : undefined}
```

In `src/App.tsx`, add to the `<ResultsList ... />` render (after `isInWatchlist={watchlist.isInCart}`):

```tsx
                    onSearchPart={(p) => runSearch(car, p)}
```

- [ ] **Step 5: Verify**

Run: `npm run lint && npm run build`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/ResultsList.tsx src/components/PartDetailModal.tsx src/App.tsx
git commit -m "Add Complete-the-Job companion chips to results and detail modal"
```

---

### Task 4: VIN decode — server route

**Files:**
- Modify: `server/nhtsa.js` (append `decodeVin`)
- Modify: `api/index.js` (import; new route near `/api/makes`)
- Test: `server/vin.test.js` (create)

**Interfaces:**
- Consumes: `fetchWithRetry`, `BASE_URL`, `CACHE_TTL_MS` already in `server/nhtsa.js`.
- Produces: `decodeVin(vin) → Promise<{ year, make, model, trim, engine: { displacementL, cylinders, driveType, fuelType } }>` (strings or null); route `GET /api/vin?vin=` → 200 that object | 400 invalid VIN | 422 undecodable | 502 upstream failure.

- [ ] **Step 1: Write the failing test** — create `server/vin.test.js`:

```js
// /api/vin with a stubbed vPIC upstream. The stub passes through every other
// URL because these tests reach the local Express server via fetch.
process.env.NODE_ENV = 'production'
process.env.SUPABASE_URL = ''
process.env.SUPABASE_ANON_KEY = ''
process.env.SUPABASE_SERVICE_ROLE_KEY = ''

import test from 'node:test'
import assert from 'node:assert/strict'

const realFetch = globalThis.fetch

function stubVpic(resultsRow) {
  globalThis.fetch = (url, opts) => {
    if (String(url).includes('vpic.nhtsa.dot.gov')) {
      return Promise.resolve(
        new Response(JSON.stringify({ Results: [resultsRow] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    }
    return realFetch(url, opts)
  }
}

const { default: app } = await import('../api/index.js')

const server = app.listen(0)
const { port } = server.address()
const base = `http://127.0.0.1:${port}`
test.after(() => {
  server.close()
  globalThis.fetch = realFetch
})

test('a missing vin is rejected', async () => {
  const res = await fetch(`${base}/api/vin`)
  assert.equal(res.status, 400)
})

test('a short vin is rejected', async () => {
  const res = await fetch(`${base}/api/vin?vin=1HGCM8263`)
  assert.equal(res.status, 400)
})

test('a vin containing I, O, or Q is rejected', async () => {
  const res = await fetch(`${base}/api/vin?vin=IHGCM82633A004352`)
  assert.equal(res.status, 400)
})

test('a decodable vin returns the mapped vehicle', async () => {
  stubVpic({
    ModelYear: '2018',
    Make: 'HONDA',
    Model: 'Civic',
    Trim: 'EX',
    DisplacementL: '1.5',
    EngineCylinders: '4',
    DriveType: 'FWD/Front-Wheel Drive',
    FuelTypePrimary: 'Gasoline',
  })
  const res = await fetch(`${base}/api/vin?vin=1HGCM82633A004352`)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(body, {
    year: '2018',
    make: 'HONDA',
    model: 'Civic',
    trim: 'EX',
    engine: { displacementL: '1.5', cylinders: '4', driveType: 'FWD/Front-Wheel Drive', fuelType: 'Gasoline' },
  })
})

test('a vin vPIC cannot decode returns 422, not fabricated fields', async () => {
  stubVpic({ ModelYear: '', Make: '', Model: '', ErrorCode: '8' })
  const res = await fetch(`${base}/api/vin?vin=5YJ3E1EA7KF317000`)
  assert.equal(res.status, 422)
})

test('decodes are cached per vin (second call skips upstream)', async () => {
  let calls = 0
  globalThis.fetch = (url, opts) => {
    if (String(url).includes('vpic.nhtsa.dot.gov')) {
      calls++
      return Promise.resolve(
        new Response(JSON.stringify({ Results: [{ ModelYear: '2020', Make: 'TOYOTA', Model: 'Camry' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    }
    return realFetch(url, opts)
  }
  await fetch(`${base}/api/vin?vin=4T1B11HK5KU700001`)
  await fetch(`${base}/api/vin?vin=4T1B11HK5KU700001`)
  assert.equal(calls, 1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "C:/Users/chado/Documents/car part finder" && node --test "server/vin.test.js"`
Expected: FAIL — `/api/vin` returns 404 (route missing).

- [ ] **Step 3: Implement `decodeVin` in `server/nhtsa.js`** (append at end of file):

```js
const vinCache = new Map()
const vinPromises = new Map()
const MAX_VIN_CACHE = 500

// Full-VIN decode via vPIC DecodeVinValues (flat single-row response). Returns
// nulls for fields vPIC doesn't know rather than guessing — the route decides
// whether the decode is usable. Cached like makes/models (VINs are immutable).
export async function decodeVin(vin) {
  const key = vin.toUpperCase()
  const cached = vinCache.get(key)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data
  }

  if (vinPromises.has(key)) {
    return vinPromises.get(key)
  }

  const promise = (async () => {
    try {
      const res = await fetchWithRetry(
        `${BASE_URL}/DecodeVinValues/${encodeURIComponent(key)}?format=json`,
        {},
        { timeoutMs: 10000, retries: 2 }
      )
      if (!res.ok) throw new Error(`NHTSA VIN decode failed (${res.status})`)
      const data = await res.json()
      const row = data.Results?.[0] || {}
      const clean = (v) => {
        const s = v == null ? '' : String(v).trim()
        return s || null
      }
      const decoded = {
        year: clean(row.ModelYear),
        make: clean(row.Make),
        model: clean(row.Model),
        trim: clean(row.Trim),
        engine: {
          displacementL: clean(row.DisplacementL),
          cylinders: clean(row.EngineCylinders),
          driveType: clean(row.DriveType),
          fuelType: clean(row.FuelTypePrimary),
        },
      }
      if (vinCache.size >= MAX_VIN_CACHE) {
        vinCache.delete(vinCache.keys().next().value)
      }
      vinCache.set(key, { data: decoded, expiresAt: Date.now() + CACHE_TTL_MS })
      return decoded
    } finally {
      vinPromises.delete(key)
    }
  })()

  vinPromises.set(key, promise)
  return promise
}
```

- [ ] **Step 4: Add the route in `api/index.js`**

Change the nhtsa import to `import { getMakes, getModels, decodeVin } from '../server/nhtsa.js'`. Add after the `/api/models` route:

```js
// 17 chars; letters I, O, Q are never used in a VIN (avoids 0/1 confusion).
const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/i

app.get('/api/vin', async (req, res) => {
  const vin = String(req.query.vin || '').trim()
  if (!VIN_RE.test(vin)) {
    return res.status(400).json({ error: 'A 17-character VIN is required (the letters I, O, and Q never appear in a VIN)' })
  }
  try {
    const decoded = await decodeVin(vin)
    // vPIC answers 200 even for VINs it can't resolve; an unusable decode is a
    // client-visible condition, not fabricated fallback data.
    if (!decoded.year || !decoded.make || !decoded.model) {
      return res.status(422).json({ error: "Couldn't decode that VIN — try picking your vehicle manually" })
    }
    res.json(decoded)
  } catch (err) {
    console.error(err)
    res.status(502).json({ error: 'Failed to fetch data' })
  }
})
```

- [ ] **Step 5: Run tests**

Run: `node --test "server/vin.test.js"` → PASS (6 tests). Then `npm test` → all pass.

- [ ] **Step 6: Commit**

```bash
git add server/nhtsa.js api/index.js server/vin.test.js
git commit -m "Add /api/vin NHTSA VIN decode with cache and honest 422 on partial decodes"
```

---

### Task 5: VIN decode — frontend (CarSelector)

**Files:**
- Modify: `src/api/client.ts` (append)
- Modify: `src/components/CarSelector.tsx` (types, state, VIN row, garage save)

**Interfaces:**
- Consumes: `GET /api/vin` from Task 4; `toast` from sonner; existing `getJson`.
- Produces: `decodeVinApi(vin) → Promise<VinDecodeResult>` in client.ts; `export type GarageVehicle = Car & { vin?: string; mileage?: number }` from CarSelector (Task 7 depends on `GarageVehicle`).

- [ ] **Step 1: client.ts** (append):

```ts
export type VinDecodeResult = {
  year: string
  make: string
  model: string
  trim: string | null
  engine: {
    displacementL: string | null
    cylinders: string | null
    driveType: string | null
    fuelType: string | null
  }
}

export function decodeVinApi(vin: string): Promise<VinDecodeResult> {
  const params = new URLSearchParams({ vin })
  return getJson(`/api/vin?${params.toString()}`)
}
```

- [ ] **Step 2: CarSelector — types, imports, state**

Update imports:

```ts
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, AlertCircle, X, BookmarkPlus, Check, ScanLine } from 'lucide-react'
import { toast } from 'sonner'
import { fetchMakes, fetchModels, fetchTrims, decodeVinApi, type VehicleType } from '../api/client'
```

Below the `Car` type add:

```ts
// Garage entries carry optional enrichment (VIN from a decode, user-entered
// mileage). All fields optional so pre-existing localStorage entries parse.
export type GarageVehicle = Car & { vin?: string; mileage?: number }
```

Change the garage state type: `useState<GarageVehicle[]>` and `addToGarage = (carToAdd: GarageVehicle) => {` (duplicate check stays on year/make/model/trim).

Add VIN state after the `trim` state:

```ts
  const [vinInput, setVinInput] = useState('')
  const [vinLoading, setVinLoading] = useState(false)
  const [vinError, setVinError] = useState<string | null>(null)
  // The VIN that produced the current selection; cleared on any manual change
  // so a stale VIN is never saved onto a hand-edited vehicle.
  const [decodedVin, setDecodedVin] = useState<string | null>(null)
  // Model/trim from a decode must be applied AFTER the models/trims effects
  // run, because those effects clear model and trim when year/make change.
  const pendingVin = useRef<{ model: string; trim: string } | null>(null)
```

- [ ] **Step 3: CarSelector — apply pending decode inside the existing effects**

In the models effect, change the `.then` branch to:

```ts
      .then((res) => {
        if (cancelled) return
        setModels(res.models)
        if (pendingVin.current) {
          const match = res.models.find((m) => m.toLowerCase() === pendingVin.current!.model.toLowerCase())
          setModel(match ?? pendingVin.current.model)
        }
      })
```

and its `.catch` to also clear the pending decode:

```ts
      .catch((err) => {
        if (!cancelled) {
          setError(err.message)
          pendingVin.current = null
        }
      })
```

In the trims effect, apply and clear the pending trim in both outcomes:

```ts
      .then((res) => {
        if (cancelled) return
        setTrims(res.trims)
        if (pendingVin.current) {
          const want = pendingVin.current.trim
          const match = res.trims.find((t) => t.toLowerCase() === want.toLowerCase())
          setTrim(match ?? want)
          pendingVin.current = null
        }
      })
      .catch(() => {
        // Trim data is a nice-to-have; fall back to free text silently on failure.
        if (!cancelled) {
          setTrims([])
          if (pendingVin.current) {
            setTrim(pendingVin.current.trim)
            pendingVin.current = null
          }
        }
      })
```

- [ ] **Step 4: CarSelector — decode handler + VIN row UI**

Handler (above the `return`):

```ts
  const handleDecodeVin = async () => {
    setVinLoading(true)
    setVinError(null)
    try {
      const d = await decodeVinApi(vinInput)
      pendingVin.current = { model: d.model, trim: d.trim || '' }
      setYear(d.year)
      setMake(d.make)
      setDecodedVin(vinInput)
      const engineBits = [
        d.engine.displacementL && `${d.engine.displacementL}L`,
        d.engine.cylinders && `${d.engine.cylinders}-cyl`,
        d.engine.driveType,
      ].filter(Boolean).join(' · ')
      toast.success(`Decoded: ${d.year} ${d.make} ${d.model}${engineBits ? ` — ${engineBits}` : ''}`)
    } catch (err) {
      setVinError(err instanceof Error ? err.message : "Couldn't decode that VIN — pick your vehicle manually below")
    } finally {
      setVinLoading(false)
    }
  }
```

VIN row JSX, inserted directly ABOVE the `Vehicle type` block (`<div className="mt-6">` with the type toggle):

```tsx
      <div className="mt-6">
        <label htmlFor="vin-input" className="field-label flex items-center gap-1.5">
          <ScanLine size={13} className="text-brand-600" /> Have your VIN? Decode it (fastest)
        </label>
        <div className="flex gap-2">
          <input
            id="vin-input"
            type="text"
            value={vinInput}
            onChange={(e) => {
              setVinInput(e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '').slice(0, 17))
              setVinError(null)
            }}
            placeholder="17-character VIN — driver's door jamb or windshield"
            maxLength={17}
            className="field font-data flex-1 uppercase tracking-[0.08em]"
          />
          <button
            type="button"
            onClick={handleDecodeVin}
            disabled={vinInput.length !== 17 || vinLoading}
            className="btn btn-secondary shrink-0 px-4"
          >
            {vinLoading ? 'Decoding…' : 'Decode'}
          </button>
        </div>
        {vinError && <p className="mt-1.5 text-xs text-rose-600">{vinError}</p>}
      </div>
```

- [ ] **Step 5: CarSelector — invalidate decodedVin on manual edits and carry it into the garage**

Manual-change invalidation — update the three Combobox `onChange` handlers:

```tsx
          onChange={(v) => { setYear(v); setDecodedVin(null) }}
```
```tsx
            onChange={(v) => { setMake(v); setDecodedVin(null) }}
```
```tsx
          onChange={(v) => { setModel(v); setDecodedVin(null) }}
```

(Trim changes don't invalidate — the VIN still identifies the vehicle.)

Save button: change `onClick={() => addToGarage({ year, make, model, trim })}` to:

```tsx
                onClick={() => addToGarage({ year, make, model, trim, ...(decodedVin ? { vin: decodedVin } : {}) })}
```

- [ ] **Step 6: Verify**

Run: `npm run lint && npm run build`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/api/client.ts src/components/CarSelector.tsx
git commit -m "Add VIN decode entry that autofills the vehicle selector"
```

---

### Task 6: Recalls — server route

**Files:**
- Create: `server/recalls.js`
- Modify: `api/index.js` (import; new route after `/api/vehicle-image`)
- Test: `server/recalls.test.js` (create)

**Interfaces:**
- Consumes: `fetchWithRetry` from `server/httpClient.js`; existing `vehicleError` in `api/index.js`.
- Produces: `getRecalls(make, model, year) → Promise<Recall[]>` where `Recall = { campaignNumber, component, summary, consequence, remedy, reportedDate }` (strings or null); route `GET /api/recalls?year&make&model` → 200 `{ recalls }` | 400 | 502.

- [ ] **Step 1: Write the failing test** — create `server/recalls.test.js`:

```js
// /api/recalls with a stubbed api.nhtsa.gov upstream (pass-through elsewhere).
process.env.NODE_ENV = 'production'
process.env.SUPABASE_URL = ''
process.env.SUPABASE_ANON_KEY = ''
process.env.SUPABASE_SERVICE_ROLE_KEY = ''

import test from 'node:test'
import assert from 'node:assert/strict'

const realFetch = globalThis.fetch

function stubRecalls(handler) {
  globalThis.fetch = (url, opts) => {
    if (String(url).includes('api.nhtsa.gov')) return Promise.resolve(handler(String(url)))
    return realFetch(url, opts)
  }
}

const { default: app } = await import('../api/index.js')

const server = app.listen(0)
const { port } = server.address()
const base = `http://127.0.0.1:${port}`
test.after(() => {
  server.close()
  globalThis.fetch = realFetch
})

test('missing params are rejected', async () => {
  const res = await fetch(`${base}/api/recalls?make=Honda&model=Civic`)
  assert.equal(res.status, 400)
})

test('an invalid year is rejected', async () => {
  const res = await fetch(`${base}/api/recalls?year=1492&make=Honda&model=Civic`)
  assert.equal(res.status, 400)
})

test('recalls are mapped to the app shape', async () => {
  stubRecalls(() =>
    new Response(
      JSON.stringify({
        Count: 1,
        results: [{
          NHTSACampaignNumber: '23V123000',
          Component: 'FUEL SYSTEM, GASOLINE',
          Summary: 'Fuel pump may fail.',
          Consequence: 'Engine stall increases crash risk.',
          Remedy: 'Dealers replace the fuel pump free of charge.',
          ReportReceivedDate: '01/05/2023',
        }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  )
  const res = await fetch(`${base}/api/recalls?year=2019&make=Honda&model=CR-V`)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(body.recalls, [{
    campaignNumber: '23V123000',
    component: 'FUEL SYSTEM, GASOLINE',
    summary: 'Fuel pump may fail.',
    consequence: 'Engine stall increases crash risk.',
    remedy: 'Dealers replace the fuel pump free of charge.',
    reportedDate: '01/05/2023',
  }])
})

test('no recalls returns an empty array, not an error', async () => {
  stubRecalls(() =>
    new Response(JSON.stringify({ Count: 0, results: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  )
  const res = await fetch(`${base}/api/recalls?year=2024&make=Toyota&model=Camry`)
  assert.equal(res.status, 200)
  assert.deepEqual((await res.json()).recalls, [])
})

test('an upstream failure returns 502', async () => {
  // 400 is non-retryable, so this fails fast without burning retry backoff.
  stubRecalls(() => new Response('bad', { status: 400 }))
  const res = await fetch(`${base}/api/recalls?year=2018&make=Ford&model=F-150`)
  assert.equal(res.status, 502)
})

test('results are cached per vehicle (second call skips upstream)', async () => {
  let calls = 0
  stubRecalls(() => {
    calls++
    return new Response(JSON.stringify({ Count: 0, results: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  await fetch(`${base}/api/recalls?year=2021&make=Subaru&model=Outback`)
  await fetch(`${base}/api/recalls?year=2021&make=Subaru&model=Outback`)
  assert.equal(calls, 1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test "server/recalls.test.js"`
Expected: FAIL — 404 on `/api/recalls`.

- [ ] **Step 3: Create `server/recalls.js`**

```js
import { fetchWithRetry } from './httpClient.js'

// NHTSA's recalls API (separate from vPIC): free, keyless, authoritative.
// Recall campaigns change rarely, so a day of caching is safe and keeps a
// popular garage vehicle from re-hitting NHTSA on every visit.
const RECALLS_URL = 'https://api.nhtsa.gov/recalls/recallsByVehicle'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const MAX_CACHE = 500

const cache = new Map()
const pending = new Map()

export async function getRecalls(make, model, year) {
  const key = `${year}::${make}::${model}`.toLowerCase()
  const cached = cache.get(key)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data
  }

  if (pending.has(key)) {
    return pending.get(key)
  }

  const promise = (async () => {
    try {
      const params = new URLSearchParams({ make, model, modelYear: year })
      const res = await fetchWithRetry(`${RECALLS_URL}?${params.toString()}`, {}, { timeoutMs: 10000, retries: 2 })
      if (!res.ok) throw new Error(`NHTSA recalls lookup failed (${res.status})`)
      const data = await res.json()
      const clean = (v) => {
        const s = v == null ? '' : String(v).trim()
        return s || null
      }
      const recalls = (data.results || []).map((r) => ({
        campaignNumber: clean(r.NHTSACampaignNumber),
        component: clean(r.Component),
        summary: clean(r.Summary),
        consequence: clean(r.Consequence),
        remedy: clean(r.Remedy),
        reportedDate: clean(r.ReportReceivedDate),
      }))
      if (cache.size >= MAX_CACHE) {
        cache.delete(cache.keys().next().value)
      }
      cache.set(key, { data: recalls, expiresAt: Date.now() + CACHE_TTL_MS })
      return recalls
    } finally {
      pending.delete(key)
    }
  })()

  pending.set(key, promise)
  return promise
}
```

- [ ] **Step 4: Add the route in `api/index.js`**

Add `import { getRecalls } from '../server/recalls.js'` next to the other server imports. After the `/api/vehicle-image` route add:

```js
app.get('/api/recalls', async (req, res) => {
  const { year, make, model } = req.query
  const invalid = vehicleError({ year, make, model })
  if (invalid) {
    return res.status(400).json({ error: invalid })
  }
  try {
    const recalls = await getRecalls(String(make), String(model), String(year))
    // Recall campaigns are stable reference data — let the browser cache too.
    res.set('Cache-Control', 'public, max-age=86400')
    res.json({ recalls })
  } catch (err) {
    console.error(err)
    res.status(502).json({ error: 'Failed to fetch data' })
  }
})
```

- [ ] **Step 5: Run tests**

Run: `node --test "server/recalls.test.js"` → PASS (6 tests). Then `npm test` → all pass.

- [ ] **Step 6: Commit**

```bash
git add server/recalls.js server/recalls.test.js api/index.js
git commit -m "Add /api/recalls backed by NHTSA recallsByVehicle with daily cache"
```

---

### Task 7: Vehicle Health frontend (maintenance data + modal + garage integration)

**Files:**
- Create: `src/data/maintenanceSchedule.ts`
- Create: `src/lib/recallCache.ts`
- Create: `src/components/VehicleHealthModal.tsx`
- Modify: `src/api/client.ts` (append `fetchRecalls`)
- Modify: `src/components/CarSelector.tsx` (health button, badge, modal state, mileage update, new prop)
- Modify: `src/App.tsx` (pass `onSearchPart` to CarSelector)

**Interfaces:**
- Consumes: `GET /api/recalls` (Task 6); `GarageVehicle` (Task 5); `Modal` from `src/components/Modal.tsx` (`{ label, onClose, children, maxWidth? }`); `RadarMark`; `isElectricVehicle`; `partTypes`.
- Produces: `fetchRecalls(year, make, model) → Promise<{ recalls: Recall[] }>`; `maintenanceForVehicle(isElectric) → MaintenanceItem[]`; `readCachedRecalls/writeCachedRecalls/cachedRecallCount` (sessionStorage); `VehicleHealthModal` props `{ vehicle: GarageVehicle; onClose(): void; onUpdateMileage(m: number | undefined): void; onShopPart(part: string): void }`; CarSelector prop `onSearchPart?: (car: Car, part: string) => void`.

- [ ] **Step 1: `src/data/maintenanceSchedule.ts`** (create):

```ts
import { partTypes } from './partTypes'

export type MaintenanceItem = {
  // Must match a partTypes name — "Shop" runs a normal part search.
  part: string
  intervalMiles: number
  note: string
}

// Broad industry rules of thumb, NOT vehicle-specific schedules. The UI must
// always label these "typical" and point at the owner's manual. There is
// deliberately no due-date math: without real service history, "due now"
// would be fabricated precision.
export const maintenanceSchedule: MaintenanceItem[] = [
  { part: 'Oil Filter', intervalMiles: 5000, note: 'Replaced at every oil change' },
  { part: 'Windshield Wipers', intervalMiles: 12000, note: 'Or about once a year' },
  { part: 'Cabin Air Filter', intervalMiles: 15000, note: 'Keeps HVAC airflow strong' },
  { part: 'Air Filter', intervalMiles: 15000, note: 'Sooner on dusty roads' },
  { part: 'Brake Pads', intervalMiles: 40000, note: '30k–70k depending on driving' },
  { part: 'Battery', intervalMiles: 50000, note: 'Typically lasts 3–5 years' },
  { part: 'Brake Rotors', intervalMiles: 60000, note: 'Often replaced with pads' },
  { part: 'Spark Plugs', intervalMiles: 60000, note: '30k copper; up to 100k iridium' },
  { part: 'Coolant', intervalMiles: 60000, note: 'Flush per the manual spec' },
  { part: 'Transmission Fluid', intervalMiles: 60000, note: 'If serviceable — check the manual' },
  { part: 'Serpentine Belt', intervalMiles: 75000, note: 'Sooner if cracked or squealing' },
  { part: 'Timing Belt', intervalMiles: 90000, note: 'Critical on interference engines' },
]

// EVs skip combustion-only items but keep the rest (12V battery, wipers,
// brakes, cabin filter all still wear).
export function maintenanceForVehicle(isElectric: boolean): MaintenanceItem[] {
  if (!isElectric) return maintenanceSchedule
  const iceOnly = new Set(partTypes.filter((p) => p.powertrain === 'ice').map((p) => p.name))
  return maintenanceSchedule.filter((m) => !iceOnly.has(m.part))
}
```

- [ ] **Step 2: `src/lib/recallCache.ts`** (create):

```ts
import type { Recall } from '../api/client'

// Session-scoped recall cache: the garage badge only shows a count that was
// actually fetched this session — never a placeholder or a guess.
const cacheKey = (year: string, make: string, model: string) =>
  `cpf-recalls-${year}|${make}|${model}`.toLowerCase()

export function readCachedRecalls(year: string, make: string, model: string): Recall[] | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(year, make, model))
    return raw ? (JSON.parse(raw) as Recall[]) : null
  } catch {
    return null
  }
}

export function writeCachedRecalls(year: string, make: string, model: string, recalls: Recall[]) {
  try {
    sessionStorage.setItem(cacheKey(year, make, model), JSON.stringify(recalls))
  } catch {
    // Session cache is a bonus; storage may be full or blocked.
  }
}

export function cachedRecallCount(year: string, make: string, model: string): number | null {
  const recalls = readCachedRecalls(year, make, model)
  return recalls ? recalls.length : null
}
```

- [ ] **Step 3: `src/api/client.ts`** (append):

```ts
export type Recall = {
  campaignNumber: string | null
  component: string | null
  summary: string | null
  consequence: string | null
  remedy: string | null
  reportedDate: string | null
}

export function fetchRecalls(year: string, make: string, model: string): Promise<{ recalls: Recall[] }> {
  const params = new URLSearchParams({ year, make, model })
  return getJson(`/api/recalls?${params.toString()}`)
}
```

- [ ] **Step 4: `src/components/VehicleHealthModal.tsx`** (create):

```tsx
import { useEffect, useState } from 'react'
import { AlertTriangle, ShieldCheck, Gauge, ShoppingCart } from 'lucide-react'
import { Modal } from './Modal'
import { RadarMark } from './RadarMark'
import { fetchRecalls, type Recall } from '../api/client'
import { readCachedRecalls, writeCachedRecalls } from '../lib/recallCache'
import { maintenanceForVehicle } from '../data/maintenanceSchedule'
import { isElectricVehicle } from '../data/electricVehicles'
import type { GarageVehicle } from './CarSelector'

export function VehicleHealthModal({
  vehicle,
  onClose,
  onUpdateMileage,
  onShopPart,
}: {
  vehicle: GarageVehicle
  onClose: () => void
  onUpdateMileage: (mileage: number | undefined) => void
  onShopPart: (part: string) => void
}) {
  const [recalls, setRecalls] = useState<Recall[] | null>(
    () => readCachedRecalls(vehicle.year, vehicle.make, vehicle.model)
  )
  const [recallsError, setRecallsError] = useState(false)
  const [mileageInput, setMileageInput] = useState(vehicle.mileage != null ? String(vehicle.mileage) : '')

  useEffect(() => {
    if (recalls !== null) return // session cache hit
    let cancelled = false
    fetchRecalls(vehicle.year, vehicle.make, vehicle.model)
      .then((res) => {
        if (cancelled) return
        setRecalls(res.recalls)
        writeCachedRecalls(vehicle.year, vehicle.make, vehicle.model, res.recalls)
      })
      .catch(() => {
        // An honest error line, never a silent empty state.
        if (!cancelled) setRecallsError(true)
      })
    return () => {
      cancelled = true
    }
  }, [recalls, vehicle.year, vehicle.make, vehicle.model])

  const commitMileage = () => {
    const parsed = Number(mileageInput.replace(/[^0-9]/g, ''))
    onUpdateMileage(Number.isFinite(parsed) && parsed > 0 ? parsed : undefined)
  }

  const maintenance = maintenanceForVehicle(isElectricVehicle(vehicle.make, vehicle.model))
  const vehicleLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ''}`

  return (
    <Modal label={`${vehicleLabel} — vehicle health`} onClose={onClose} maxWidth="max-w-3xl">
      <div className="border-b px-6 py-4">
        <div className="eyebrow text-brand-600 dark:text-brand-400">Vehicle health</div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl text-slate-950">{vehicleLabel}</h2>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Gauge size={14} className="text-slate-400" />
            Mileage
            <input
              type="text"
              inputMode="numeric"
              value={mileageInput}
              onChange={(e) => setMileageInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 7))}
              onBlur={commitMileage}
              placeholder="e.g. 84000"
              aria-label="Current mileage"
              className="field font-data w-28 px-3 py-1.5 text-sm"
            />
          </label>
        </div>
        {vehicle.vin && (
          <p className="font-data mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-400">VIN · {vehicle.vin}</p>
        )}
      </div>

      <div className="space-y-8 p-6">
        <section>
          <h3 className="section-title text-lg">Open recalls</h3>
          <p className="mt-0.5 text-xs text-slate-500">Live from the NHTSA recall database</p>

          {recallsError ? (
            <p className="mt-4 flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
              <AlertTriangle size={15} className="shrink-0" />
              Couldn't reach the NHTSA recall database — try again later.
            </p>
          ) : recalls === null ? (
            <div className="mt-4 flex items-center gap-2.5 text-sm text-slate-500" role="status">
              <RadarMark className="h-5 w-5 text-brand-600 dark:text-brand-400" /> Checking NHTSA…
            </div>
          ) : recalls.length === 0 ? (
            <p className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
              <ShieldCheck size={15} className="shrink-0" />
              No open recalls found in the NHTSA database
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {recalls.map((r, i) => (
                <li key={r.campaignNumber ?? i} className="rounded-xl border border-rose-100 bg-rose-50/60 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge bg-rose-600 text-white">Recall</span>
                    {r.campaignNumber && (
                      <span className="font-data text-[11px] font-semibold uppercase tracking-[0.1em] text-rose-700">
                        {r.campaignNumber}
                      </span>
                    )}
                    {r.reportedDate && <span className="text-[11px] text-slate-400">{r.reportedDate}</span>}
                  </div>
                  {r.component && <p className="mt-2 text-sm font-semibold text-slate-900">{r.component}</p>}
                  {r.summary && <p className="mt-1 text-sm leading-relaxed text-slate-600">{r.summary}</p>}
                  {r.remedy && (
                    <p className="mt-2 text-xs text-slate-500">
                      <span className="font-semibold text-slate-600">Remedy:</span> {r.remedy}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="section-title text-lg">Typical maintenance</h3>
          <p className="mt-0.5 text-xs text-slate-500">Typical intervals — always check your owner's manual.</p>
          <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800/60">
            {maintenance.map((m) => (
              <li key={m.part} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">{m.part}</div>
                  <div className="text-xs text-slate-500">
                    <span className="font-data">~{m.intervalMiles.toLocaleString()} mi</span> · {m.note}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onShopPart(m.part)}
                  className="btn btn-secondary shrink-0 px-3 py-1.5 text-xs"
                >
                  <ShoppingCart size={13} /> Shop
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="flex justify-end border-t bg-slate-50 px-6 py-4">
        <button type="button" onClick={onClose} className="btn btn-ghost px-4 py-2 text-sm">Close</button>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 5: CarSelector — health button, badge, modal, prop**

Add imports: `Activity` to the lucide import list; `import { VehicleHealthModal } from './VehicleHealthModal'`; `import { cachedRecallCount } from '../lib/recallCache'`.

Change the component signature to accept the new prop:

```tsx
export function CarSelector({
  onConfirm,
  onSearchPart,
}: {
  onConfirm: (car: Car) => void
  onSearchPart?: (car: Car, part: string) => void
}) {
```

Add state next to the garage state: `const [healthIndex, setHealthIndex] = useState<number | null>(null)`.

In the garage card, replace the lone remove-button block

```tsx
                <button
                  type="button"
                  onClick={(e) => removeFromGarage(i, e)}
                  aria-label="Remove vehicle"
                  className="rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-rose-600 transition"
                >
                  <X size={13} />
                </button>
```

with a button group that adds the Health button and recall badge:

```tsx
                <div className="flex shrink-0 items-center gap-1">
                  {(() => {
                    const count = cachedRecallCount(c.year, c.make, c.model)
                    return count != null && count > 0 ? (
                      <span className="badge bg-rose-100 text-rose-700 px-1.5 text-[10px]">
                        {count} recall{count === 1 ? '' : 's'}
                      </span>
                    ) : null
                  })()}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setHealthIndex(i)
                    }}
                    aria-label={`Vehicle health for ${c.year} ${c.make} ${c.model}`}
                    className="rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-brand-600 transition"
                  >
                    <Activity size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => removeFromGarage(i, e)}
                    aria-label="Remove vehicle"
                    className="rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-rose-600 transition"
                  >
                    <X size={13} />
                  </button>
                </div>
```

At the end of the component's JSX (just before the closing `</div>` of the card), render the modal:

```tsx
      {healthIndex !== null && garage[healthIndex] && (
        <VehicleHealthModal
          vehicle={garage[healthIndex]}
          onClose={() => setHealthIndex(null)}
          onUpdateMileage={(mileage) =>
            setGarage((prev) => prev.map((c, i) => (i === healthIndex ? { ...c, mileage } : c)))
          }
          onShopPart={(shopPart) => {
            const v = garage[healthIndex]
            setHealthIndex(null)
            onSearchPart?.({ year: v.year, make: v.make, model: v.model, trim: v.trim }, shopPart)
          }}
        />
      )}
```

- [ ] **Step 6: App wiring** — in `src/App.tsx` change the CarSelector render to:

```tsx
                    <CarSelector
                      onConfirm={(selectedCar) => navigate({ step: 'part', car: selectedCar, part: null })}
                      onSearchPart={(garageCar, garagePart) => runSearch(garageCar, garagePart)}
                    />
```

- [ ] **Step 7: Verify**

Run: `npm run lint && npm run build`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/data/maintenanceSchedule.ts src/lib/recallCache.ts src/components/VehicleHealthModal.tsx src/api/client.ts src/components/CarSelector.tsx src/App.tsx
git commit -m "Add garage Vehicle Health: NHTSA recalls plus typical-maintenance shop links"
```

---

### Task 8: Price history — schema + recorder + write hooks

**Files:**
- Modify: `server/supabase-schema.sql` (append)
- Create: `server/priceHistory.js`
- Modify: `api/index.js` (`/api/search` handler)
- Modify: `server/workers/priceChecker.js` (both alert loops)
- Test: `server/priceHistory.test.js` (create)

**Interfaces:**
- Consumes: `supabaseAdmin`, `accountsAvailable` from `server/supabase.js`.
- Produces: `normalizeSignature({ year, make, model, part })`; `recordPriceObservation({ year, make, model, part, total }) → Promise<{ recorded: boolean }>` (never throws); `getPriceHistory({ year, make, model, part }, { days? }) → Promise<{ date, price }[]>` (Task 9 uses this).

- [ ] **Step 1: Write the failing test** — create `server/priceHistory.test.js`:

```js
// Production with Supabase unconfigured: the recorder and reader must be
// silent no-ops — never a throw, never a network call.
process.env.NODE_ENV = 'production'
process.env.SUPABASE_URL = ''
process.env.SUPABASE_ANON_KEY = ''
process.env.SUPABASE_SERVICE_ROLE_KEY = ''

import test from 'node:test'
import assert from 'node:assert/strict'

const { normalizeSignature, recordPriceObservation, getPriceHistory } = await import('./priceHistory.js')

test('normalizeSignature lowercases and trims the searchable fields', () => {
  assert.deepEqual(
    normalizeSignature({ year: ' 2018 ', make: ' Honda', model: 'CIVIC ', part: ' Brake Pads ' }),
    { year: '2018', make: 'honda', model: 'civic', part: 'brake pads' }
  )
})

test('recordPriceObservation is a no-op when accounts are unavailable', async () => {
  const result = await recordPriceObservation({ year: '2018', make: 'Honda', model: 'Civic', part: 'Brake Pads', total: 42.5 })
  assert.deepEqual(result, { recorded: false })
})

test('recordPriceObservation rejects junk prices without throwing', async () => {
  assert.deepEqual(await recordPriceObservation({ year: '2018', make: 'Honda', model: 'Civic', part: 'Brake Pads', total: 0 }), { recorded: false })
  assert.deepEqual(await recordPriceObservation({ year: '2018', make: 'Honda', model: 'Civic', part: 'Brake Pads', total: NaN }), { recorded: false })
})

test('getPriceHistory returns [] when accounts are unavailable', async () => {
  assert.deepEqual(await getPriceHistory({ year: '2018', make: 'Honda', model: 'Civic', part: 'Brake Pads' }), [])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test "server/priceHistory.test.js"`
Expected: FAIL — cannot find module `./priceHistory.js`.

- [ ] **Step 3: Create `server/priceHistory.js`**

```js
import { supabaseAdmin, accountsAvailable } from './supabase.js'

// Real observed prices only: one row per (vehicle, part) per day holding the
// lowest total (price + shipping) actually seen that day. This is the honest
// replacement for the fabricated trend chart removed in 27904e6.

export function normalizeSignature({ year, make, model, part }) {
  const norm = (s) => String(s ?? '').trim().toLowerCase()
  return { year: String(year ?? '').trim(), make: norm(make), model: norm(model), part: norm(part) }
}

// Never throws and never blocks meaningfully: callers await it (Vercel may
// freeze the function after the response is sent, so fire-and-forget writes
// can be silently dropped), but a failure only logs.
export async function recordPriceObservation({ year, make, model, part, total }) {
  if (!accountsAvailable || !supabaseAdmin) return { recorded: false }
  const price = Number(total)
  if (!Number.isFinite(price) || price <= 0) return { recorded: false }
  const sig = normalizeSignature({ year, make, model, part })
  if (!sig.year || !sig.make || !sig.model || !sig.part) return { recorded: false }
  const observedDate = new Date().toISOString().slice(0, 10)

  try {
    const { data: existing, error: selectError } = await supabaseAdmin
      .from('price_history')
      .select('id, price')
      .eq('year', sig.year)
      .eq('make', sig.make)
      .eq('model', sig.model)
      .eq('part', sig.part)
      .eq('observed_date', observedDate)
      .maybeSingle()
    if (selectError) throw selectError

    if (!existing) {
      // A concurrent insert can race this; the unique index makes the loser
      // error, which lands in the catch below — acceptable, the day's row exists.
      const { error } = await supabaseAdmin
        .from('price_history')
        .insert({ ...sig, observed_date: observedDate, price })
      if (error) throw error
    } else if (price < Number(existing.price)) {
      const { error } = await supabaseAdmin.from('price_history').update({ price }).eq('id', existing.id)
      if (error) throw error
    }
    return { recorded: true }
  } catch (err) {
    // A history write must never break search or the cron.
    console.error('[priceHistory] record failed:', err?.message)
    return { recorded: false }
  }
}

export async function getPriceHistory({ year, make, model, part }, { days = 90 } = {}) {
  if (!accountsAvailable || !supabaseAdmin) return []
  const sig = normalizeSignature({ year, make, model, part })
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data, error } = await supabaseAdmin
    .from('price_history')
    .select('observed_date, price')
    .eq('year', sig.year)
    .eq('make', sig.make)
    .eq('model', sig.model)
    .eq('part', sig.part)
    .gte('observed_date', since)
    .order('observed_date', { ascending: true })
  if (error) {
    console.error('[priceHistory] read failed:', error.message)
    return []
  }
  return (data || []).map((r) => ({ date: r.observed_date, price: Number(r.price) }))
}
```

- [ ] **Step 4: Append the table to `server/supabase-schema.sql`**

```sql

-- ============================================
-- PRICE HISTORY (daily observed lows per search signature)
-- ============================================
-- Written only by the server with the service-role key (organic searches and
-- the alert cron); RLS is enabled with no policies so the anon key can neither
-- read nor write. make/model/part are stored normalized lowercase.
create table if not exists public.price_history (
  id uuid primary key default uuid_generate_v4(),
  year text not null,
  make text not null,
  model text not null,
  part text not null,
  observed_date date not null,
  price numeric not null,
  created_at timestamptz default now()
);

alter table public.price_history enable row level security;

create unique index if not exists idx_price_history_daily
  on public.price_history (year, make, model, part, observed_date);
```

- [ ] **Step 5: Hook into `/api/search`** (in `api/index.js`)

Add `import { recordPriceObservation } from '../server/priceHistory.js'` next to the other server imports. In the `/api/search` handler, replace:

```js
    const result = await searchCheapestListings({
      year: String(year),
      make: String(make),
      model: String(model),
      trim: trim ? String(trim) : undefined,
      part: String(part),
      zip: cleanZip,
    })
    res.json(result)
```

with:

```js
    const result = await searchCheapestListings({
      year: String(year),
      make: String(make),
      model: String(model),
      trim: trim ? String(trim) : undefined,
      part: String(part),
      zip: cleanZip,
    })
    // Record the day's observed low from genuinely live results only (cache
    // hits re-observe nothing; stale results are old data). Awaited because
    // Vercel can freeze the function right after res.json; recordPriceObservation
    // never throws, so this cannot fail the search.
    if (!result.cached && !result.stale && result.results.length > 0) {
      const cheapestTotal = result.results.reduce(
        (best, r) => Math.min(best, r.price + (r.shippingCost || 0)),
        Infinity
      )
      await recordPriceObservation({ year, make, model, part, total: cheapestTotal })
    }
    res.json(result)
```

- [ ] **Step 6: Hook into the cron worker** (`server/workers/priceChecker.js`)

Add `import { recordPriceObservation } from '../priceHistory.js'` after the existing imports. In the **account** loop, after `checked++`, add:

```js
      if (cheapest) {
        await recordPriceObservation({ year: search.year, make: search.make, model: search.model, part: search.part, total: cheapest.total })
      }
```

In the **guest** loop, after its `checked++`, add:

```js
      if (cheapest) {
        await recordPriceObservation({ year: alert.year, make: alert.make, model: alert.model, part: alert.part, total: cheapest.total })
      }
```

(Both loops still have their existing `if (cheapest)` blocks for alert updates — this is a separate preceding statement, kept separate so history accrues even when no alert triggers.)

- [ ] **Step 7: Run tests**

Run: `node --test "server/priceHistory.test.js"` → PASS (4 tests). Then `npm test` → all pass.

- [ ] **Step 8: Commit**

```bash
git add server/priceHistory.js server/priceHistory.test.js server/supabase-schema.sql api/index.js server/workers/priceChecker.js
git commit -m "Record daily observed-low price history from live searches and the alert cron"
```

---

### Task 9: Price history — read API + sparkline card

**Files:**
- Modify: `api/index.js` (route + limiter mount)
- Modify: `src/api/client.ts` (append)
- Create: `src/components/Sparkline.tsx`
- Modify: `src/components/ResultsList.tsx` (fetch + aside card)
- Test: `server/priceHistoryRoute.test.js` (create)

**Interfaces:**
- Consumes: `getPriceHistory` (Task 8); `searchLimiter` in `api/index.js`; `vehicleError`.
- Produces: `GET /api/price-history?year&make&model&part` → 200 `{ observations: [{ date, price }] }` | 400; `fetchPriceHistory(year, make, model, part)`; `Sparkline({ points })` component.

- [ ] **Step 1: Write the failing test** — create `server/priceHistoryRoute.test.js`:

```js
// /api/price-history in production with Supabase unconfigured: valid requests
// get an honest empty series (the UI hides the card), junk gets 400.
process.env.NODE_ENV = 'production'
process.env.SUPABASE_URL = ''
process.env.SUPABASE_ANON_KEY = ''
process.env.SUPABASE_SERVICE_ROLE_KEY = ''

import test from 'node:test'
import assert from 'node:assert/strict'

const { default: app } = await import('../api/index.js')

const server = app.listen(0)
const { port } = server.address()
const base = `http://127.0.0.1:${port}`
test.after(() => server.close())

test('a missing part is rejected', async () => {
  const res = await fetch(`${base}/api/price-history?year=2018&make=Honda&model=Civic`)
  assert.equal(res.status, 400)
})

test('an invalid year is rejected', async () => {
  const res = await fetch(`${base}/api/price-history?year=1492&make=Honda&model=Civic&part=Brake+Pads`)
  assert.equal(res.status, 400)
})

test('a valid request with accounts unavailable returns an empty series', async () => {
  const res = await fetch(`${base}/api/price-history?year=2018&make=Honda&model=Civic&part=Brake+Pads`)
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { observations: [] })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test "server/priceHistoryRoute.test.js"`
Expected: FAIL — 404 on `/api/price-history`.

- [ ] **Step 3: Route + limiter in `api/index.js`**

Extend the priceHistory import: `import { recordPriceObservation, getPriceHistory } from '../server/priceHistory.js'`. Next to the other limiter mounts add:

```js
// History reads hit Supabase, so they share the search budget.
app.use('/api/price-history', searchLimiter)
```

After the `/api/recalls` route add:

```js
app.get('/api/price-history', async (req, res) => {
  const { year, make, model, part } = req.query
  if (!part || !String(part).trim()) {
    return res.status(400).json({ error: 'part query param is required' })
  }
  const invalid = vehicleError({ year, make, model, part })
  if (invalid) {
    return res.status(400).json({ error: invalid })
  }
  // getPriceHistory never throws (it returns [] and logs), so no try/catch.
  const observations = await getPriceHistory({ year, make, model, part })
  res.json({ observations })
})
```

- [ ] **Step 4: Run route tests**

Run: `node --test "server/priceHistoryRoute.test.js"` → PASS (3 tests).

- [ ] **Step 5: `src/api/client.ts`** (append):

```ts
export type PriceObservation = { date: string; price: number }

export function fetchPriceHistory(
  year: string,
  make: string,
  model: string,
  part: string
): Promise<{ observations: PriceObservation[] }> {
  const params = new URLSearchParams({ year, make, model, part })
  return getJson(`/api/price-history?${params.toString()}`)
}
```

- [ ] **Step 6: `src/components/Sparkline.tsx`** (create):

```tsx
// Pure-SVG sparkline for real observed prices — no chart library. Strokes use
// currentColor so the parent sets the color in both themes.
export function Sparkline({ points }: { points: { date: string; price: number }[] }) {
  if (points.length < 2) return null
  const w = 240
  const h = 56
  const pad = 4
  const prices = points.map((p) => p.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const span = max - min || 1
  const x = (i: number) => pad + (i * (w - pad * 2)) / (points.length - 1)
  const y = (v: number) => h - pad - ((v - min) * (h - pad * 2)) / span
  const path = points.map((p, i) => `${x(i).toFixed(1)},${y(p.price).toFixed(1)}`).join(' ')
  const last = points[points.length - 1]

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full"
      role="img"
      aria-label={`Price history: low $${min.toFixed(2)}, high $${max.toFixed(2)}, latest $${last.price.toFixed(2)}`}
    >
      <polyline points={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(points.length - 1)} cy={y(last.price)} r="2.5" fill="currentColor" />
    </svg>
  )
}
```

- [ ] **Step 7: ResultsList — fetch + card**

Add imports: `TrendingDown` to the lucide import list; `fetchPriceHistory, type PriceObservation` to the `../api/client` import; `import { Sparkline } from './Sparkline'`.

Add state + effect after the search effect:

```tsx
  // Real observed daily lows for this search signature. Absence is normal
  // (history only accrues once Supabase is configured), so errors just hide it.
  const [history, setHistory] = useState<PriceObservation[]>([])

  useEffect(() => {
    let cancelled = false
    setHistory([])
    fetchPriceHistory(car.year, car.make, car.model, part)
      .then((res) => {
        if (!cancelled) setHistory(res.observations)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [car.year, car.make, car.model, part])
```

In the aside, BETWEEN the "Compare at other stores" card and `{bestPrice > 0 && <PriceAlertCard ... />}`, add (5+ real observations required — matches the spec):

```tsx
              {history.length >= 5 && (
                <div className="card p-6">
                  <div className="flex items-center gap-3">
                    <div className="icon-tile bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400"><TrendingDown size={17} /></div>
                    <div>
                      <div className="font-semibold tracking-tight text-slate-950">Price radar — observed lows</div>
                      <div className="text-xs text-slate-500">Lowest daily total we've actually seen for this search</div>
                    </div>
                  </div>
                  <div className="mt-4 text-brand-600 dark:text-brand-400">
                    <Sparkline points={history} />
                  </div>
                  <div className="font-data mt-3 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">
                    <span>Low ${Math.min(...history.map((p) => p.price)).toFixed(2)}</span>
                    <span>High ${Math.max(...history.map((p) => p.price)).toFixed(2)}</span>
                    <span>Since {new Date(`${history[0].date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                </div>
              )}
```

- [ ] **Step 8: Verify + full suite**

Run: `npm run lint && npm run build && npm test`
Expected: all exit 0.

- [ ] **Step 9: Commit**

```bash
git add api/index.js src/api/client.ts src/components/Sparkline.tsx src/components/ResultsList.tsx server/priceHistoryRoute.test.js
git commit -m "Serve observed price history and render the sparkline card on results"
```

---

### Task 10: Final verification + delivery notes

- [ ] **Step 1: Full suite**

Run: `npm test`
Expected: all tests pass (60 pre-existing + ~19 new), exit 0.

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: exit 0.

- [ ] **Step 3: Live smoke test on a scratch port** (do NOT touch port 3001 — may be the user's dev server)

Run (Bash tool, from repo root):

```bash
PORT=3111 node server/index.js &
sleep 3
curl -s "http://127.0.0.1:3111/api/vin?vin=1HGCM82633A004352"
curl -s "http://127.0.0.1:3111/api/recalls?year=2019&make=Honda&model=CR-V"
curl -s "http://127.0.0.1:3111/api/price-history?year=2018&make=Honda&model=Civic&part=Brake+Pads"
```

Expected: VIN returns a real 2003 Accord decode (live NHTSA); recalls returns a JSON `recalls` array; price-history returns `{"observations":[]}` (Supabase unconfigured locally unless keys exist). Kill only this scratch process afterward.

- [ ] **Step 4: Report delivery + external setup checklist to the user**

The user must do (no code): create the Supabase project + run `server/supabase-schema.sql` + set `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` in Vercel; set `RESEND_API_KEY`/`RESEND_FROM`; join eBay Partner Network and set `EBAY_EPN_CAMPAIGN_ID`. Everything ships dark until then.

---

## Verification (end-to-end)

1. `npm test` — full server/api suite green.
2. `npm run lint && npm run build` — frontend compiles.
3. Scratch-port smoke (Task 10 Step 3) proves `/api/vin`, `/api/recalls`, `/api/price-history` respond correctly against live NHTSA + unconfigured Supabase.
4. UI flows to eyeball in the dev app (user-visible): VIN box on the vehicle step autofills a decode; garage card shows the Health button → recalls + maintenance modal → "Shop" lands on results; results aside shows "Complete the job" chips that launch companion searches; price-history card stays hidden (correct: no observations yet); eBay links unchanged until `EBAY_EPN_CAMPAIGN_ID` is set.

## Self-review notes

- Spec coverage: A→Task 1, B→Tasks 2-3, C→Tasks 8-9, D→Tasks 6-7, E→Tasks 4-5; cross-cutting constraints in Global Constraints. Rollout order preserved (A, B, E, D, C).
- Type consistency: `GarageVehicle` defined once (Task 5) and consumed in Task 7; `Recall` defined once in client.ts (Task 7) and consumed by recallCache/VehicleHealthModal; `getPriceHistory` shape matches route + `PriceObservation`; `decodeVinApi` named to avoid colliding with the server's `decodeVin`.
- The `/api/search` history hook awaits (Vercel freeze-after-response) but cannot throw — guaranteed by `recordPriceObservation`'s catch-all.
