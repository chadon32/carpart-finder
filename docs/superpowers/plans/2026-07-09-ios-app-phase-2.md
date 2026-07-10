# iOS App Phase 2 (Watchlist, Detail Sheet, Compare, Share, Recents) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the app's engagement layer: a persisted watchlist with live price deltas and a tab badge, a native listing detail sheet with share, compare (2–4 listings), and recent searches on the Search home.

**Architecture:** Same patterns as Phase 1 — Zustand + AsyncStorage stores with pure logic under test, Expo Router screens, theme tokens from `mobile/src/theme.ts`. The detail sheet and compare screens are modal routes; listing data travels as a JSON route param (listings are small). Current prices for watched items refresh via the existing `/api/prices` endpoint.

**Tech Stack:** Existing mobile stack (Expo SDK 57, Zustand, AsyncStorage, expo-haptics, expo-web-browser). No new dependencies except none — swipe-to-delete uses `react-native-gesture-handler` already in the template.

## Global Constraints

- Same as Phase 1: API base `https://carpartsradar.com` with `X-App-Platform: ios`; types mirror web; honesty guardrail (price deltas only from real fetched prices — show "—" when `/api/prices` has no data, never fabricate); ≥44pt touch targets; system dark mode; no analytics.
- All work in `mobile/`; verify each task with `npm test` and `npx tsc --noEmit`; commit with the repo's convention.
- Route params must be strings — listings cross routes as `JSON.stringify(listing)` in a `listing` param.

---

### Task 1: fetchPrices client + watchlist store (TDD)

**Files:**
- Modify: `mobile/src/api/client.ts` (add `PriceInfo`, `fetchPrices`)
- Create: `mobile/src/stores/watchlist.ts`
- Test: `mobile/src/stores/__tests__/watchlist.test.ts`, extend `mobile/src/api/__tests__/client.test.ts`

**Interfaces:**
- Produces: `PriceInfo = { available: boolean; price?: number | null }`; `fetchPrices(ids: string[]): Promise<{ prices: Record<string, PriceInfo> }>`.
- `WatchItem = Listing & { addedAt: number; priceAtAdd: number; carLabel: string; part: string }`.
- `useWatchlist` hook — `{ items: WatchItem[]; watch(listing, carLabel, part): void; unwatch(id: string): void; isWatched(id: string): boolean }`. Watch dedupes on `listing.id`; newest first. Persisted under `cpr-watchlist`.

- [ ] **Step 1: Failing tests.** Append to `client.test.ts`:

```ts
test('fetchPrices joins ids into one query', async () => {
  mockFetch.mockReturnValue(jsonResponse({ prices: { a: { available: true, price: 9 } } }))
  const res = await fetchPrices(['a', 'b'])
  expect(res.prices.a.price).toBe(9)
  expect(mockFetch.mock.calls[0][0]).toBe(`${API_BASE}/api/prices?ids=a%2Cb`)
})
```

(Import `fetchPrices` in the existing import line.) Create `watchlist.test.ts`:

```ts
import { useWatchlist } from '../watchlist'
import type { Listing } from '../../api/types'

const listing = { id: 'l1', title: 'Pads', price: 20 } as Listing

beforeEach(() => useWatchlist.setState({ items: [] }))

test('watch stores price at add time and dedupes by id', () => {
  useWatchlist.getState().watch(listing, '2015 Toyota Camry', 'Brake Pads')
  useWatchlist.getState().watch(listing, '2015 Toyota Camry', 'Brake Pads')
  const items = useWatchlist.getState().items
  expect(items).toHaveLength(1)
  expect(items[0].priceAtAdd).toBe(20)
  expect(items[0].part).toBe('Brake Pads')
})

test('unwatch removes by listing id, isWatched reflects state', () => {
  useWatchlist.getState().watch(listing, 'car', 'part')
  expect(useWatchlist.getState().isWatched('l1')).toBe(true)
  useWatchlist.getState().unwatch('l1')
  expect(useWatchlist.getState().isWatched('l1')).toBe(false)
})
```

- [ ] **Step 2: Run** `cd mobile; npm test` → FAIL (fetchPrices/watchlist missing).

- [ ] **Step 3: Implement.** In `client.ts` (after `fetchVehicleImage`):

```ts
export type PriceInfo = { available: boolean; price?: number | null }

export function fetchPrices(ids: string[]): Promise<{ prices: Record<string, PriceInfo> }> {
  return getJson(`/api/prices?${new URLSearchParams({ ids: ids.join(',') })}`)
}
```

`mobile/src/stores/watchlist.ts`:

```ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Listing } from '../api/types'

export type WatchItem = Listing & {
  addedAt: number
  priceAtAdd: number
  carLabel: string
  part: string
}

type WatchlistState = {
  items: WatchItem[]
  watch: (listing: Listing, carLabel: string, part: string) => void
  unwatch: (id: string) => void
  isWatched: (id: string) => boolean
}

export const useWatchlist = create<WatchlistState>()(
  persist(
    (set, get) => ({
      items: [],
      watch: (listing, carLabel, part) =>
        set((s) => ({
          items: [
            { ...listing, addedAt: Date.now(), priceAtAdd: listing.price, carLabel, part },
            ...s.items.filter((i) => i.id !== listing.id),
          ],
        })),
      unwatch: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      isWatched: (id) => get().items.some((i) => i.id === id),
    }),
    { name: 'cpr-watchlist', storage: createJSONStorage(() => AsyncStorage) }
  )
)
```

- [ ] **Step 4: Run** `cd mobile; npm test` → all pass.
- [ ] **Step 5: Commit** `git add mobile/src; git commit -m "Add watchlist store and prices client"`.

---

### Task 2: Compare store + price delta helper (TDD)

**Files:**
- Create: `mobile/src/stores/compare.ts`, `mobile/src/lib/priceDelta.ts`
- Test: `mobile/src/stores/__tests__/compare.test.ts`, `mobile/src/lib/__tests__/priceDelta.test.ts`

**Interfaces:**
- `useCompare` — `{ listings: Listing[]; toggle(l: Listing): void; clear(): void; isComparing(id: string): boolean }`. Toggle adds (max 4, silently ignores 5th) or removes. Not persisted (session-scoped).
- `priceDelta(priceAtAdd: number, current: number | null | undefined): { text: string; direction: 'down' | 'up' | 'flat' | 'unknown' }` — "unknown" → text `'—'`; otherwise signed dollar delta, e.g. `'-$3.50'`, `'+$1.00'`, `'$0.00'`.

- [ ] **Step 1: Failing tests.** `compare.test.ts`:

```ts
import { useCompare } from '../compare'
import type { Listing } from '../../api/types'

const l = (id: string) => ({ id } as Listing)

beforeEach(() => useCompare.setState({ listings: [] }))

test('toggle adds then removes', () => {
  useCompare.getState().toggle(l('a'))
  expect(useCompare.getState().isComparing('a')).toBe(true)
  useCompare.getState().toggle(l('a'))
  expect(useCompare.getState().isComparing('a')).toBe(false)
})

test('caps at 4 listings', () => {
  for (const id of ['a', 'b', 'c', 'd', 'e']) useCompare.getState().toggle(l(id))
  expect(useCompare.getState().listings).toHaveLength(4)
  expect(useCompare.getState().isComparing('e')).toBe(false)
})

test('clear empties', () => {
  useCompare.getState().toggle(l('a'))
  useCompare.getState().clear()
  expect(useCompare.getState().listings).toHaveLength(0)
})
```

`priceDelta.test.ts`:

```ts
import { priceDelta } from '../priceDelta'

test('down, up, flat, unknown', () => {
  expect(priceDelta(20, 16.5)).toEqual({ text: '-$3.50', direction: 'down' })
  expect(priceDelta(20, 21)).toEqual({ text: '+$1.00', direction: 'up' })
  expect(priceDelta(20, 20)).toEqual({ text: '$0.00', direction: 'flat' })
  expect(priceDelta(20, null)).toEqual({ text: '—', direction: 'unknown' })
  expect(priceDelta(20, undefined)).toEqual({ text: '—', direction: 'unknown' })
})
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** `compare.ts`:

```ts
import { create } from 'zustand'
import type { Listing } from '../api/types'

type CompareState = {
  listings: Listing[]
  toggle: (l: Listing) => void
  clear: () => void
  isComparing: (id: string) => boolean
}

export const useCompare = create<CompareState>()((set, get) => ({
  listings: [],
  toggle: (l) =>
    set((s) => {
      if (s.listings.some((x) => x.id === l.id))
        return { listings: s.listings.filter((x) => x.id !== l.id) }
      if (s.listings.length >= 4) return s
      return { listings: [...s.listings, l] }
    }),
  clear: () => set({ listings: [] }),
  isComparing: (id) => get().listings.some((x) => x.id === id),
}))
```

`priceDelta.ts`:

```ts
// Honesty guardrail: no fetched price means no claim — '—', never a guess.
export function priceDelta(
  priceAtAdd: number,
  current: number | null | undefined
): { text: string; direction: 'down' | 'up' | 'flat' | 'unknown' } {
  if (current == null) return { text: '—', direction: 'unknown' }
  const diff = current - priceAtAdd
  if (diff === 0) return { text: '$0.00', direction: 'flat' }
  const sign = diff > 0 ? '+' : '-'
  return { text: `${sign}$${Math.abs(diff).toFixed(2)}`, direction: diff > 0 ? 'up' : 'down' }
}
```

- [ ] **Step 4: Run** → all pass. **Step 5: Commit** `git add mobile/src; git commit -m "Add compare store and price delta helper"`.

---

### Task 3: Listing detail sheet with share and watch

**Files:**
- Create: `mobile/src/app/listing-detail.tsx`
- Modify: `mobile/src/app/_layout.tsx` (register modal route), `mobile/src/app/results.tsx` (card tap → detail; pass carLabel/part)

**Interfaces:**
- Consumes: `useWatchlist`, `priceDelta` not needed here; `Listing` via `JSON.parse(params.listing)`; `params.carLabel`, `params.part`.
- Produces: route `/listing-detail` (modal). Card tap in results now pushes it; the Buy action opens the browser.

- [ ] **Step 1:** Register in `_layout.tsx`: `<Stack.Screen name="listing-detail" options={{ title: 'Listing', presentation: 'modal' }} />`.

- [ ] **Step 2:** `listing-detail.tsx` — scrollable sheet: hero image, title, badge pills, price + strikethrough original + shipping, seller block (feedback %, score, location, top-rated), condition, delivery window (`deliveryMin`–`deliveryMax`), `shortDescription` when present, and a sticky footer with three actions: **Buy on eBay** (primary, `WebBrowser.openBrowserAsync(listing.link)`), **Watch/Watching** (toggles `useWatchlist`, success haptic on add), **Share** (`Share.share({ message: `${listing.title} — $${listing.price.toFixed(2)}`, url: listing.link })`). Footer buttons ≥50pt tall.

- [ ] **Step 3:** In `results.tsx`, replace the card `onPress` handler: `router.push({ pathname: '/listing-detail', params: { listing: JSON.stringify(item), carLabel: `${year} ${make} ${model}`, part } })` (keep the haptic). Buy-on-eBay moves into the sheet.

- [ ] **Step 4:** `npx tsc --noEmit` → 0; on-device: tap card → sheet slides up, actions work, swipe-down dismisses.

- [ ] **Step 5: Commit** `git add mobile/src; git commit -m "Add listing detail sheet with buy, watch, share"`.

---

### Task 4: Watchlist tab with price deltas and tab badge

**Files:**
- Modify: `mobile/src/app/(tabs)/watchlist.tsx` (real screen), `mobile/src/app/(tabs)/_layout.tsx` (badge)

**Interfaces:**
- Consumes: `useWatchlist`, `fetchPrices`, `priceDelta`.

- [ ] **Step 1:** Watchlist screen: on focus (`useFocusEffect` from expo-router), fetch current prices for all item ids via `fetchPrices`, hold in local state `Record<string, PriceInfo>`. Render `FlatList` of rows: thumbnail, title (2 lines), carLabel · part caption, `$priceAtAdd → current` with the delta chip colored by direction (down = green, up = rose, unknown = neutral '—'), Buy (opens browser) and Remove (unwatch + light haptic) actions ≥44pt. Empty state: "Nothing watched yet — tap Watch on any listing."

- [ ] **Step 2:** Tab badge in `(tabs)/_layout.tsx`: read `const count = useWatchlist((s) => s.items.length)` and render `{count > 0 && <NativeTabs.Trigger.Badge>{String(count)}</NativeTabs.Trigger.Badge>}` inside the watchlist trigger.

- [ ] **Step 3:** `npm test`, `npx tsc --noEmit` → green. On-device: watch a listing → badge appears; watchlist shows delta or '—'; remove works; restart persists.

- [ ] **Step 4: Commit** `git add mobile/src; git commit -m "Watchlist tab with live price deltas and tab badge"`.

---

### Task 5: Compare bar and compare screen

**Files:**
- Create: `mobile/src/app/compare.tsx`
- Modify: `mobile/src/app/results.tsx` (Compare toggle on cards + floating bar), `mobile/src/components/ListingCard.tsx` (compare button), `mobile/src/app/_layout.tsx` (register route)

**Interfaces:**
- Consumes: `useCompare`.
- `ListingCard` gains props `isComparing: boolean; onToggleCompare: () => void` — renders a "Compare"/"Remove" ghost button (≥44pt) under the seller line.

- [ ] **Step 1:** Extend `ListingCard` with the compare button (ghost style: transparent bg, `c.border` border, brand text when active).
- [ ] **Step 2:** In `results.tsx`: wire `isComparing={isComparing(item.id)}`, `onToggleCompare={() => { Haptics.selectionAsync(); toggle(item) }}`. When `listings.length > 0`, render a floating bar (absolute, above the tab area: `bottom: 12`, dark `#0f172a` bg, rounded 16): "`N` selected to compare", a Clear text button, and a **Compare** primary button (disabled below 2) pushing `/compare`.
- [ ] **Step 3:** `compare.tsx` (modal route, title "Compare"): horizontal `ScrollView` of one column per listing — image, title (3 lines), price+shipping, condition, seller + feedback, delivery window, verified-fitment pill, Buy button. Column width 200. Clear-all button in header via `Stack.Screen options`.
- [ ] **Step 4:** Verify on device: select 2 → bar appears above tab bar (regression-check the web bug class: bar must float, not sit in document flow); compare screen scrolls horizontally; clear resets. `npm test` + tsc green.
- [ ] **Step 5: Commit** `git add mobile/src; git commit -m "Add compare selection bar and comparison screen"`.

---

### Task 6: Recent searches (TDD store + Search home section)

**Files:**
- Create: `mobile/src/stores/recents.ts`
- Test: `mobile/src/stores/__tests__/recents.test.ts`
- Modify: `mobile/src/app/results.tsx` (record on successful search), `mobile/src/app/(tabs)/index.tsx` (render section)

**Interfaces:**
- `RecentSearch = { car: Car; part: string; at: number }`; `useRecents` — `{ searches: RecentSearch[]; record(car: Car, part: string): void; clear(): void }`, dedupe on car+part, newest first, cap 8, persisted `cpr-recents`.

- [ ] **Step 1: Failing test** `recents.test.ts`:

```ts
import { useRecents } from '../recents'

const car = { year: '2015', make: 'Toyota', model: 'Camry', trim: '' }

beforeEach(() => useRecents.setState({ searches: [] }))

test('record dedupes car+part and caps at 8', () => {
  useRecents.getState().record(car, 'Brake Pads')
  useRecents.getState().record(car, 'Brake Pads')
  expect(useRecents.getState().searches).toHaveLength(1)
  for (let i = 0; i < 9; i++) useRecents.getState().record(car, `Part ${i}`)
  expect(useRecents.getState().searches).toHaveLength(8)
  expect(useRecents.getState().searches[0].part).toBe('Part 8')
})
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `recents.ts`:

```ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Car } from '../api/types'

export type RecentSearch = { car: Car; part: string; at: number }

type RecentsState = {
  searches: RecentSearch[]
  record: (car: Car, part: string) => void
  clear: () => void
}

const sameSearch = (a: RecentSearch, car: Car, part: string) =>
  a.part === part && a.car.year === car.year && a.car.make === car.make &&
  a.car.model === car.model && a.car.trim === car.trim

export const useRecents = create<RecentsState>()(
  persist(
    (set) => ({
      searches: [],
      record: (car, part) =>
        set((s) => ({
          searches: [
            { car, part, at: Date.now() },
            ...s.searches.filter((x) => !sameSearch(x, car, part)),
          ].slice(0, 8),
        })),
      clear: () => set({ searches: [] }),
    }),
    { name: 'cpr-recents', storage: createJSONStorage(() => AsyncStorage) }
  )
)
```

- [ ] **Step 4:** Record in `results.tsx` when a search resolves with results (inside `run()` after `setResponse(r)`): `useRecents.getState().record({ year, make, model, trim: trim ?? '' }, part)`. Render on Search home under the garage section: "RECENT SEARCHES" label, up to 4 rows "`part` — `year make model`" (44pt rows) that `router.push('/results', …)` with those params, plus a small Clear button.
- [ ] **Step 5:** `npm test` + tsc green; commit `git add mobile/src; git commit -m "Record and surface recent searches"`.

---

### Task 7: Verification pass

- [ ] **Step 1:** `cd mobile; npm test` (expect 17+ passing) and `npx tsc --noEmit` (exit 0) and `npx expo export --platform ios` (bundle builds).
- [ ] **Step 2:** Update `mobile/VERIFICATION.md` with a "Phase 2" section listing the on-device checks: watch → badge → watchlist delta/'—' → remove; detail sheet actions (buy/watch/share) + swipe dismiss; compare bar floats above tab bar, compare screen with 2–4 columns; recents appear and re-run searches; dark mode across all new screens.
- [ ] **Step 3:** Commit `git add mobile; git commit -m "Record phase 2 verification"`.
