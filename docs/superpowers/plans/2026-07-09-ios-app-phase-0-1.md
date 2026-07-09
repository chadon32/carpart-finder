# iOS App Phase 0–1 (Scaffold + Core Search Flow) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A native iPhone app (Expo/React Native) running on the user's iPhone via Expo Go, covering garage → vehicle picker → part picker → live eBay results against the production CarPartsRadar API.

**Architecture:** New `mobile/` Expo app in this repo (web app untouched). Expo Router file-based navigation with a 3-tab layout (Search / Watchlist / Garage — Watchlist is a stub until Plan 2). Typed API client mirrors `src/api/client.ts` shapes against `https://carpartsradar.com`. Zustand stores persisted with AsyncStorage (storage adapter will swap to MMKV when we move to EAS dev builds in Plan 3).

**Tech Stack:** Expo SDK (latest stable via `create-expo-app`), TypeScript strict, Expo Router, Zustand + AsyncStorage, expo-web-browser, expo-haptics, Jest (`jest-expo`) + @testing-library/react-native.

## Global Constraints

- API base: `https://carpartsradar.com` — never embed any secret; every request sends header `X-App-Platform: ios`.
- Types must mirror the web client exactly: `Car { year, make, model, trim: string }`, `Listing` and `SearchResponse` from `src/api/client.ts` (copied verbatim in Task 2).
- Expo Go compatibility for this whole plan: only RN built-ins and `expo-*`/JS libraries (FlatList, not FlashList; AsyncStorage, not MMKV).
- Honesty guardrail: when `SearchResponse.stale` is true, show a visible "Live search failed — showing recent results" banner; never present stale/cached as live. Empty results show an empty state, never fabricated listings.
- Touch targets ≥ 44pt. Dark mode follows the system (`useColorScheme`).
- No analytics/tracking SDKs.
- All commands run from repo root on Windows PowerShell unless the step says otherwise; app code lives under `mobile/`.
- Commits use the existing repo convention (imperative subject, `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` footer).

---

### Task 1: Scaffold the Expo app

**Files:**
- Create: `mobile/` (via create-expo-app), then edit `mobile/app.json`, `mobile/app/(tabs)/_layout.tsx`, `mobile/app/(tabs)/index.tsx`, `mobile/app/(tabs)/watchlist.tsx`, `mobile/app/(tabs)/garage.tsx`
- Modify: `.gitignore` (root — no change needed; create-expo-app writes `mobile/.gitignore`)

**Interfaces:**
- Produces: route names other tasks push to: `/(tabs)` (Search tab at `index`), `/(tabs)/watchlist`, `/(tabs)/garage`. Tab icons use `@expo/vector-icons` `Ionicons`.

- [ ] **Step 1: Scaffold**

```powershell
npx create-expo-app@latest mobile --template default
```

Expected: a `mobile/` directory with `app/`, `package.json`, TypeScript preconfigured, expo-router installed.

- [ ] **Step 2: Configure app identity in `mobile/app.json`**

Set these keys inside `expo` (keep everything else the template wrote):

```json
{
  "name": "CarPartsRadar",
  "slug": "carpartsradar",
  "scheme": "carpartsradar",
  "version": "1.0.0",
  "orientation": "portrait",
  "userInterfaceStyle": "automatic",
  "ios": {
    "bundleIdentifier": "com.carpartsradar.app",
    "supportsTablet": false
  }
}
```

- [ ] **Step 3: Reduce the template to three tabs**

Replace `mobile/app/(tabs)/_layout.tsx` with:

```tsx
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#2050c8', headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size }) => <Ionicons name="search" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          title: 'Watchlist',
          tabBarIcon: ({ color, size }) => <Ionicons name="bookmark-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="garage"
        options={{
          title: 'Garage',
          tabBarIcon: ({ color, size }) => <Ionicons name="car-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  )
}
```

Create `mobile/app/(tabs)/watchlist.tsx` and `mobile/app/(tabs)/garage.tsx` as placeholders (same pattern, different title):

```tsx
import { View, Text } from 'react-native'

export default function WatchlistScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Watchlist — coming in Plan 2</Text>
    </View>
  )
}
```

Replace `mobile/app/(tabs)/index.tsx` with a minimal Search home (real one arrives in Task 5):

```tsx
import { View, Text } from 'react-native'

export default function SearchScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>CarPartsRadar</Text>
    </View>
  )
}
```

Delete template screens/components the tabs no longer reference (e.g. `app/(tabs)/explore.tsx`, unused example components) so `tsc` stays clean.

- [ ] **Step 4: Verify typecheck and dev server**

```powershell
cd mobile; npx tsc --noEmit; npx expo start --tunnel
```

Expected: tsc exits 0; expo prints a QR code. **User action:** scan with the iPhone Camera app → opens in Expo Go → three tabs render. Stop the server after confirming.

- [ ] **Step 5: Commit**

```powershell
git add mobile; git commit -m "Scaffold Expo iOS app with three-tab layout"
```

---

### Task 2: Typed API client (TDD)

**Files:**
- Create: `mobile/src/api/types.ts`, `mobile/src/api/client.ts`, `mobile/src/api/__tests__/client.test.ts`
- Modify: `mobile/package.json` (jest config), `mobile/jest.setup.js`

**Interfaces:**
- Produces:
  - `types.ts`: `Car { year: string; make: string; model: string; trim: string }`, `GarageVehicle = Car & { vin?: string; mileage?: number }`, plus `Listing`, `SearchResponse`, `VehicleType`, `VinDecodeResult` copied **verbatim** from web `src/api/client.ts:1-38,49,169-180`.
  - `client.ts`: `fetchMakes(type?: VehicleType): Promise<{ makes: string[] }>`, `fetchModels(make: string, year: string): Promise<{ models: string[] }>`, `fetchTrims(year, make, model): Promise<{ trims: string[] }>`, `searchParts(year, make, model, part, trim?): Promise<SearchResponse>`, `decodeVinApi(vin: string): Promise<VinDecodeResult>`, `fetchVehicleImage(make, model, year?): Promise<{ imageUrl: string | null }>`. All throw `Error(data.error || 'Request failed (STATUS)')` on non-OK.

- [ ] **Step 1: Install test tooling**

```powershell
cd mobile; npx expo install jest-expo jest @types/jest; npm i -D @testing-library/react-native
```

Add to `mobile/package.json`:

```json
"scripts": { "test": "jest" },
"jest": { "preset": "jest-expo", "setupFiles": ["<rootDir>/jest.setup.js"] }
```

Create `mobile/jest.setup.js` (empty for now, reserved for global mocks):

```js
// Global test setup.
```

- [ ] **Step 2: Write failing tests** in `mobile/src/api/__tests__/client.test.ts`:

```ts
import { fetchMakes, searchParts, API_BASE } from '../client'

const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  Promise.resolve({ ok, status, json: () => Promise.resolve(body) })

beforeEach(() => mockFetch.mockReset())

test('fetchMakes hits the production API with the platform header', async () => {
  mockFetch.mockReturnValue(jsonResponse({ makes: ['TOYOTA'] }))
  const res = await fetchMakes('car')
  expect(res.makes).toEqual(['TOYOTA'])
  const [url, init] = mockFetch.mock.calls[0]
  expect(url).toBe(`${API_BASE}/api/makes?type=car`)
  expect(init.headers['X-App-Platform']).toBe('ios')
})

test('searchParts builds the query and returns the typed response', async () => {
  mockFetch.mockReturnValue(
    jsonResponse({ query: 'q', results: [], providerErrors: {}, skippedProviders: [] })
  )
  const res = await searchParts('2015', 'Toyota', 'Camry', 'Brake Pads')
  expect(res.results).toEqual([])
  expect(mockFetch.mock.calls[0][0]).toBe(
    `${API_BASE}/api/search?year=2015&make=Toyota&model=Camry&part=Brake+Pads`
  )
})

test('non-OK responses throw the server error message', async () => {
  mockFetch.mockReturnValue(jsonResponse({ error: 'year must be 4 digits' }, false, 400))
  await expect(fetchMakes()).rejects.toThrow('year must be 4 digits')
})
```

- [ ] **Step 3: Run to verify failure**

```powershell
cd mobile; npm test
```

Expected: FAIL — cannot find module `../client`.

- [ ] **Step 4: Implement**

`mobile/src/api/types.ts` — copy `Listing`, `SearchResponse`, `VehicleType`, `VinDecodeResult` verbatim from web `src/api/client.ts`, and add:

```ts
export type Car = { year: string; make: string; model: string; trim: string }
export type GarageVehicle = Car & { vin?: string; mileage?: number }
```

`mobile/src/api/client.ts`:

```ts
import type { SearchResponse, VehicleType, VinDecodeResult } from './types'

export const API_BASE = 'https://carpartsradar.com'

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'X-App-Platform': 'ios' },
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`)
  }
  return data as T
}

export function fetchMakes(type: VehicleType = 'all'): Promise<{ makes: string[] }> {
  const params = type === 'all' ? '' : `?${new URLSearchParams({ type })}`
  return getJson(`/api/makes${params}`)
}

export function fetchModels(make: string, year: string): Promise<{ models: string[] }> {
  return getJson(`/api/models?${new URLSearchParams({ make, year })}`)
}

export function fetchTrims(year: string, make: string, model: string): Promise<{ trims: string[] }> {
  return getJson(`/api/trims?${new URLSearchParams({ year, make, model })}`)
}

export function fetchVehicleImage(
  make: string,
  model: string,
  year?: string
): Promise<{ imageUrl: string | null }> {
  const params = new URLSearchParams({ make, model, v: '2' })
  if (year) params.set('year', year)
  return getJson(`/api/vehicle-image?${params}`)
}

export function searchParts(
  year: string,
  make: string,
  model: string,
  part: string,
  trim?: string
): Promise<SearchResponse> {
  const params = new URLSearchParams({ year, make, model, part })
  if (trim) params.set('trim', trim)
  return getJson(`/api/search?${params}`)
}

export function decodeVinApi(vin: string): Promise<VinDecodeResult> {
  return getJson(`/api/vin?${new URLSearchParams({ vin })}`)
}
```

- [ ] **Step 5: Run tests**

```powershell
cd mobile; npm test
```

Expected: 3 passing.

- [ ] **Step 6: Commit**

```powershell
git add mobile/src/api mobile/package.json mobile/jest.setup.js mobile/package-lock.json
git commit -m "Add typed API client for the production CarPartsRadar API"
```

---

### Task 3: Garage store with persistence (TDD)

**Files:**
- Create: `mobile/src/stores/garage.ts`, `mobile/src/stores/__tests__/garage.test.ts`

**Interfaces:**
- Consumes: `GarageVehicle` from `mobile/src/api/types.ts`.
- Produces: `useGarage` Zustand hook — state `{ vehicles: GarageVehicle[] }`, actions `addVehicle(v: GarageVehicle): void` (dedupes on year+make+model+trim, newest first, caps at 10), `removeVehicle(index: number): void`. Persisted under key `cpr-garage`.

- [ ] **Step 1: Install dependencies**

```powershell
cd mobile; npx expo install zustand @react-native-async-storage/async-storage
```

- [ ] **Step 2: Write failing tests** in `mobile/src/stores/__tests__/garage.test.ts`:

```ts
import { useGarage } from '../garage'

const car = { year: '2015', make: 'Toyota', model: 'Camry', trim: '' }

beforeEach(() => useGarage.setState({ vehicles: [] }))

test('addVehicle prepends and dedupes identical vehicles', () => {
  useGarage.getState().addVehicle(car)
  useGarage.getState().addVehicle({ ...car })
  expect(useGarage.getState().vehicles).toHaveLength(1)
  useGarage.getState().addVehicle({ ...car, year: '2016' })
  expect(useGarage.getState().vehicles[0].year).toBe('2016')
})

test('garage caps at 10 vehicles', () => {
  for (let y = 2000; y < 2012; y++) useGarage.getState().addVehicle({ ...car, year: String(y) })
  expect(useGarage.getState().vehicles).toHaveLength(10)
})

test('removeVehicle removes by index', () => {
  useGarage.getState().addVehicle(car)
  useGarage.getState().removeVehicle(0)
  expect(useGarage.getState().vehicles).toHaveLength(0)
})
```

Add AsyncStorage mock to `mobile/jest.setup.js`:

```js
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)
```

- [ ] **Step 3: Run to verify failure** — `cd mobile; npm test` → FAIL (module not found).

- [ ] **Step 4: Implement** `mobile/src/stores/garage.ts`:

```ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { GarageVehicle } from '../api/types'

type GarageState = {
  vehicles: GarageVehicle[]
  addVehicle: (v: GarageVehicle) => void
  removeVehicle: (index: number) => void
}

const sameCar = (a: GarageVehicle, b: GarageVehicle) =>
  a.year === b.year && a.make === b.make && a.model === b.model && a.trim === b.trim

export const useGarage = create<GarageState>()(
  persist(
    (set) => ({
      vehicles: [],
      addVehicle: (v) =>
        set((s) => ({
          vehicles: [v, ...s.vehicles.filter((x) => !sameCar(x, v))].slice(0, 10),
        })),
      removeVehicle: (index) =>
        set((s) => ({ vehicles: s.vehicles.filter((_, i) => i !== index) })),
    }),
    { name: 'cpr-garage', storage: createJSONStorage(() => AsyncStorage) }
  )
)
```

- [ ] **Step 5: Run tests** — `cd mobile; npm test` → all passing (client tests too).

- [ ] **Step 6: Commit**

```powershell
git add mobile/src/stores mobile/jest.setup.js mobile/package.json mobile/package-lock.json
git commit -m "Add persisted garage store"
```

---

### Task 4: Theme tokens and part-type data

**Files:**
- Create: `mobile/src/theme.ts`, `mobile/src/data/partTypes.ts`

**Interfaces:**
- Produces: `theme.ts` exports `brand = '#2050c8'`, `useThemeColors(): { bg, card, text, subtext, border, brand }` (light/dark via `useColorScheme`). `partTypes.ts` is a **verbatim copy** of web `src/data/partTypes.ts` (the `PartType` type, `partTypes` array, and the three helper functions).

- [ ] **Step 1: Implement** `mobile/src/theme.ts`:

```ts
import { useColorScheme } from 'react-native'

export const brand = '#2050c8'

const light = { bg: '#fafafa', card: '#ffffff', text: '#0f172a', subtext: '#64748b', border: '#e2e8f0', brand }
const dark = { bg: '#0b1220', card: '#161e2e', text: '#f1f5f9', subtext: '#94a3b8', border: '#334155', brand: '#4f79e0' }

export function useThemeColors() {
  return useColorScheme() === 'dark' ? dark : light
}
```

- [ ] **Step 2: Copy part data** — copy web `src/data/partTypes.ts` to `mobile/src/data/partTypes.ts` unchanged (it is pure TypeScript with no web dependencies).

- [ ] **Step 3: Verify** — `cd mobile; npx tsc --noEmit` → exits 0.

- [ ] **Step 4: Commit**

```powershell
git add mobile/src/theme.ts mobile/src/data
git commit -m "Add theme tokens and part-type catalog"
```

---

### Task 5: Garage tab + Search home

**Files:**
- Create: `mobile/src/components/VehicleCard.tsx`
- Modify: `mobile/app/(tabs)/garage.tsx`, `mobile/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `useGarage`, `useThemeColors`, `fetchVehicleImage`.
- Produces: `VehicleCard({ vehicle, onPress, onRemove }: { vehicle: GarageVehicle; onPress: () => void; onRemove?: () => void })`. Search home navigates with `router.push('/vehicle-picker')` (route created in Task 6) and `router.push({ pathname: '/part-picker', params: { year, make, model, trim } })` (Task 7).

- [ ] **Step 1: Implement `VehicleCard`** — a card with the vehicle photo (from `fetchVehicleImage`, loaded in a `useEffect`, `Image` with cover fit, icon fallback on null/error), `YEAR MAKE MODEL` title, optional trim subtitle, min height 64, `Pressable` with `hitSlop` and a trash icon when `onRemove` is provided:

```tsx
import { useEffect, useState } from 'react'
import { View, Text, Image, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { GarageVehicle } from '../api/types'
import { fetchVehicleImage } from '../api/client'
import { useThemeColors } from '../theme'

export function VehicleCard({ vehicle, onPress, onRemove }: {
  vehicle: GarageVehicle
  onPress: () => void
  onRemove?: () => void
}) {
  const c = useThemeColors()
  const [img, setImg] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    fetchVehicleImage(vehicle.make, vehicle.model, vehicle.year)
      .then((r) => live && setImg(r.imageUrl))
      .catch(() => {})
    return () => { live = false }
  }, [vehicle.make, vehicle.model, vehicle.year])

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
        backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.border,
        minHeight: 64,
      }}
    >
      {img ? (
        <Image source={{ uri: img }} style={{ width: 72, height: 48, borderRadius: 8 }} resizeMode="cover" />
      ) : (
        <View style={{ width: 72, height: 48, borderRadius: 8, backgroundColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="car-sport-outline" size={22} color={c.subtext} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontWeight: '700' }}>
          {vehicle.year} {vehicle.make} {vehicle.model}
        </Text>
        {vehicle.trim ? <Text style={{ color: c.subtext, fontSize: 13 }}>{vehicle.trim}</Text> : null}
      </View>
      {onRemove ? (
        <Pressable onPress={onRemove} hitSlop={12} accessibilityLabel="Remove vehicle">
          <Ionicons name="trash-outline" size={20} color={c.subtext} />
        </Pressable>
      ) : null}
    </Pressable>
  )
}
```

- [ ] **Step 2: Garage tab** (`mobile/app/(tabs)/garage.tsx`): `SafeAreaView` + `FlatList` of `VehicleCard`s (`onPress` → `router.push({ pathname: '/part-picker', params: vehicle })`, `onRemove` → `useGarage.removeVehicle(index)`), a header title "Garage", an empty state ("No vehicles yet — add one from Search"), and a footer note "Settings arrive with accounts in a later release."

- [ ] **Step 3: Search home** (`mobile/app/(tabs)/index.tsx`): brand header ("CARPARTSRADAR", brand color accent), a primary button "Find parts for a vehicle" → `router.push('/vehicle-picker')`, and if the garage is non-empty a "Your garage" section listing up to 3 `VehicleCard`s that jump straight to the part picker. Primary button:

```tsx
<Pressable
  onPress={() => router.push('/vehicle-picker')}
  style={{ backgroundColor: c.brand, borderRadius: 14, minHeight: 50, alignItems: 'center', justifyContent: 'center' }}
>
  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Find parts for a vehicle</Text>
</Pressable>
```

- [ ] **Step 4: Verify** — `cd mobile; npx tsc --noEmit` exits 0; `npx expo start --tunnel`, on iPhone: Search home renders with CTA; Garage tab shows empty state. (Vehicle-picker route 404s until Task 6 — expected.)

- [ ] **Step 5: Commit**

```powershell
git add mobile/app mobile/src/components
git commit -m "Add garage tab and search home"
```

---

### Task 6: Vehicle picker flow

**Files:**
- Create: `mobile/app/vehicle-picker.tsx`, `mobile/src/components/PickerList.tsx`
- Modify: `mobile/app/_layout.tsx` (register the stack screen with native presentation)

**Interfaces:**
- Consumes: `fetchMakes`, `fetchModels`, `fetchTrims`, `decodeVinApi`, `useGarage.addVehicle`.
- Produces: route `/vehicle-picker`; on completion it calls `addVehicle` and `router.replace({ pathname: '/part-picker', params: { year, make, model, trim } })`.
- `PickerList({ title, options, loading, onSelect, searchable })` — full-width `FlatList` of 48pt rows with checkmark-free simple rows, an optional `TextInput` filter bar, and an `ActivityIndicator` while loading.

- [ ] **Step 1: Implement `PickerList`**:

```tsx
import { useState } from 'react'
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator } from 'react-native'
import { useThemeColors } from '../theme'

export function PickerList({ title, options, loading, onSelect, searchable = false }: {
  title: string
  options: string[]
  loading?: boolean
  onSelect: (value: string) => void
  searchable?: boolean
}) {
  const c = useThemeColors()
  const [q, setQ] = useState('')
  const shown = q ? options.filter((o) => o.toLowerCase().includes(q.toLowerCase())) : options

  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: c.text, fontSize: 22, fontWeight: '800', padding: 16 }}>{title}</Text>
      {searchable ? (
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search"
          placeholderTextColor={c.subtext}
          autoCorrect={false}
          style={{
            marginHorizontal: 16, marginBottom: 8, minHeight: 44, borderRadius: 12,
            paddingHorizontal: 12, fontSize: 16, color: c.text,
            backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
          }}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onSelect(item)}
              style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: c.border }}
            >
              <Text style={{ color: c.text, fontSize: 16 }}>{item}</Text>
            </Pressable>
          )}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  )
}
```

- [ ] **Step 2: Implement the picker screen** `mobile/app/vehicle-picker.tsx` — a single route that steps through `year → make → model → trim` in local state (native back gesture pops the whole flow; an in-screen back chevron steps backwards):

```tsx
import { useEffect, useState } from 'react'
import { SafeAreaView } from 'react-native'
import { router } from 'expo-router'
import { PickerList } from '../src/components/PickerList'
import { fetchMakes, fetchModels, fetchTrims } from '../src/api/client'
import { useGarage } from '../src/stores/garage'

const YEARS = Array.from({ length: 2027 - 1990 }, (_, i) => String(2026 - i))

export default function VehiclePicker() {
  const addVehicle = useGarage((s) => s.addVehicle)
  const [year, setYear] = useState<string | null>(null)
  const [make, setMake] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [makes, setMakes] = useState<string[]>([])
  const [models, setModels] = useState<string[]>([])
  const [trims, setTrims] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!year || make) return
    setLoading(true)
    fetchMakes().then((r) => setMakes(r.makes)).catch(() => setMakes([])).finally(() => setLoading(false))
  }, [year, make])

  useEffect(() => {
    if (!year || !make || model) return
    setLoading(true)
    fetchModels(make, year).then((r) => setModels(r.models)).catch(() => setModels([])).finally(() => setLoading(false))
  }, [year, make, model])

  useEffect(() => {
    if (!year || !make || !model) return
    setLoading(true)
    fetchTrims(year, make, model).then((r) => setTrims(r.trims)).catch(() => setTrims([])).finally(() => setLoading(false))
  }, [year, make, model])

  const finish = (trim: string) => {
    const car = { year: year!, make: make!, model: model!, trim }
    addVehicle(car)
    router.replace({ pathname: '/part-picker', params: car })
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {!year ? (
        <PickerList title="Year" options={YEARS} onSelect={setYear} />
      ) : !make ? (
        <PickerList title="Make" options={makes} loading={loading} searchable onSelect={setMake} />
      ) : !model ? (
        <PickerList title="Model" options={models} loading={loading} searchable onSelect={setModel} />
      ) : (
        <PickerList
          title="Trim (optional)"
          options={['Skip', ...trims]}
          loading={loading}
          onSelect={(t) => finish(t === 'Skip' ? '' : t)}
        />
      )}
    </SafeAreaView>
  )
}
```

- [ ] **Step 3: Register the route** in `mobile/app/_layout.tsx` inside the root `<Stack>`: `<Stack.Screen name="vehicle-picker" options={{ title: 'Select vehicle', presentation: 'modal', headerShown: true }} />`.

- [ ] **Step 4: Verify on device** — `npx expo start --tunnel`: Search → CTA → year list → make list (live NHTSA data, search filters) → model list → trim → lands on part-picker 404 (Task 7 pending) **and** the vehicle appears in Garage. Kill and relaunch Expo Go: garage persists.

- [ ] **Step 5: Commit**

```powershell
git add mobile/app mobile/src/components
git commit -m "Add native vehicle picker flow"
```

---

### Task 7: Part picker

**Files:**
- Create: `mobile/app/part-picker.tsx`
- Modify: `mobile/app/_layout.tsx` (register route, `headerShown: true`, title "Choose part")

**Interfaces:**
- Consumes: `partTypes`, `popularPartTypesForVehicle` from `mobile/src/data/partTypes.ts`; route params `{ year, make, model, trim }` via `useLocalSearchParams`.
- Produces: navigates to `router.push({ pathname: '/results', params: { year, make, model, trim, part } })`.

- [ ] **Step 1: Implement** `mobile/app/part-picker.tsx`:

```tsx
import { useState } from 'react'
import { SafeAreaView, View, Text, TextInput, FlatList, Pressable } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { partTypes } from '../src/data/partTypes'
import { useThemeColors } from '../src/theme'

export default function PartPicker() {
  const c = useThemeColors()
  const { year, make, model, trim } = useLocalSearchParams<{
    year: string; make: string; model: string; trim?: string
  }>()
  const [q, setQ] = useState('')

  const goToResults = (part: string) =>
    router.push({ pathname: '/results', params: { year, make, model, trim: trim ?? '', part } })

  const shown = q
    ? partTypes.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
    : partTypes.filter((p) => p.popular)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <Text style={{ color: c.subtext, paddingHorizontal: 16, paddingTop: 8, fontWeight: '600' }}>
        {year} {String(make).toUpperCase()} {String(model).toUpperCase()}
      </Text>
      <Text style={{ color: c.text, fontSize: 22, fontWeight: '800', padding: 16 }}>
        What part do you need?
      </Text>
      <TextInput
        value={q}
        onChangeText={setQ}
        onSubmitEditing={() => q.trim() && goToResults(q.trim())}
        placeholder="Search any part (e.g. Brake Rotors)"
        placeholderTextColor={c.subtext}
        returnKeyType="search"
        autoCorrect={false}
        style={{
          marginHorizontal: 16, marginBottom: 12, minHeight: 44, borderRadius: 12,
          paddingHorizontal: 12, fontSize: 16, color: c.text,
          backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
        }}
      />
      {!q && (
        <Text style={{ color: c.subtext, paddingHorizontal: 16, paddingBottom: 8, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>
          POPULAR
        </Text>
      )}
      <FlatList
        data={shown}
        numColumns={2}
        keyExtractor={(p) => p.name}
        columnWrapperStyle={{ gap: 10, paddingHorizontal: 16 }}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => goToResults(item.name)}
            style={{
              flex: 1, minHeight: 48, borderRadius: 12, justifyContent: 'center',
              paddingHorizontal: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
            }}
          >
            <Text style={{ color: c.text, fontWeight: '600' }}>{item.name}</Text>
          </Pressable>
        )}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  )
}
```

- [ ] **Step 2: Verify on device** — from garage or picker flow: part grid renders, search filters, tapping "Brake Pads" navigates to a 404 results route (Task 8 pending).

- [ ] **Step 3: Commit**

```powershell
git add mobile/app
git commit -m "Add part picker screen"
```

---

### Task 8: Results screen (live listings)

**Files:**
- Create: `mobile/app/results.tsx`, `mobile/src/components/ListingCard.tsx`, `mobile/src/components/__tests__/resultsState.test.ts`, `mobile/src/lib/resultsState.ts`
- Modify: `mobile/app/_layout.tsx` (register route, title "Live listings")

**Interfaces:**
- Consumes: `searchParts`, `Listing`, `SearchResponse`; params `{ year, make, model, trim?, part }`.
- Produces: `deriveResultsState(r: SearchResponse | null, error: boolean): 'loading' | 'error' | 'empty' | 'stale' | 'live'` in `resultsState.ts`; `ListingCard({ listing, isBestValue, isCheapest, onPress })`.

- [ ] **Step 1: Write failing tests** for the pure state derivation in `mobile/src/components/__tests__/resultsState.test.ts`:

```ts
import { deriveResultsState } from '../../lib/resultsState'

const base = { query: 'q', results: [], providerErrors: {}, skippedProviders: [] }
const listing = { id: '1' } as never

test('loading when no response and no error', () =>
  expect(deriveResultsState(null, false)).toBe('loading'))
test('error when fetch rejected', () =>
  expect(deriveResultsState(null, true)).toBe('error'))
test('empty when live search returns nothing', () =>
  expect(deriveResultsState(base, false)).toBe('empty'))
test('stale flagged results stay marked stale', () =>
  expect(deriveResultsState({ ...base, results: [listing], stale: true }, false)).toBe('stale'))
test('live when results and not stale', () =>
  expect(deriveResultsState({ ...base, results: [listing] }, false)).toBe('live'))
```

- [ ] **Step 2: Run to verify failure** — `cd mobile; npm test` → FAIL (module not found).

- [ ] **Step 3: Implement** `mobile/src/lib/resultsState.ts`:

```ts
import type { SearchResponse } from '../api/types'

export type ResultsState = 'loading' | 'error' | 'empty' | 'stale' | 'live'

export function deriveResultsState(r: SearchResponse | null, error: boolean): ResultsState {
  if (error) return 'error'
  if (!r) return 'loading'
  if (r.results.length === 0) return 'empty'
  return r.stale ? 'stale' : 'live'
}
```

- [ ] **Step 4: Run tests** — `cd mobile; npm test` → all passing.

- [ ] **Step 5: Implement `ListingCard`** in `mobile/src/components/ListingCard.tsx`:

```tsx
import { View, Text, Image, Pressable } from 'react-native'
import type { Listing } from '../api/types'
import { useThemeColors, brand } from '../theme'

function Pill({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: '800' }}>{label}</Text>
    </View>
  )
}

export function ListingCard({ listing, isBestValue, isCheapest, onPress }: {
  listing: Listing
  isBestValue: boolean
  isCheapest: boolean
  onPress: () => void
}) {
  const c = useThemeColors()
  const shipping =
    listing.shippingCost == null ? null
    : listing.shippingCost === 0 ? 'Free shipping'
    : `+$${listing.shippingCost.toFixed(2)} shipping`

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.border,
        marginHorizontal: 16, marginBottom: 12, overflow: 'hidden',
      }}
    >
      <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: c.border }}>
        {listing.image ? (
          <Image source={{ uri: listing.image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : null}
      </View>
      <View style={{ padding: 12, gap: 8 }}>
        <Text numberOfLines={2} style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>
          {listing.title}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {isBestValue && <Pill label="BEST VALUE" bg={brand} fg="#fff" />}
          {isCheapest && <Pill label="CHEAPEST" bg="#d1fae5" fg="#047857" />}
          {listing.verifiedFitment && <Pill label="VERIFIED FITMENT" bg="#d1fae5" fg="#047857" />}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={{ color: c.text, fontSize: 22, fontWeight: '800' }}>
            ${listing.price.toFixed(2)}
          </Text>
          {listing.originalPrice ? (
            <Text style={{ color: c.subtext, textDecorationLine: 'line-through' }}>
              ${listing.originalPrice.toFixed(2)}
            </Text>
          ) : null}
          {shipping ? <Text style={{ color: c.subtext, fontSize: 13 }}>{shipping}</Text> : null}
        </View>
        <Text style={{ color: c.subtext, fontSize: 13 }}>
          {listing.condition} · {listing.seller}
          {listing.sellerFeedbackPercentage ? ` · ${listing.sellerFeedbackPercentage}%` : ''}
          {listing.sellerFeedbackScore != null ? ` (${listing.sellerFeedbackScore})` : ''}
        </Text>
      </View>
    </Pressable>
  )
}
```

- [ ] **Step 6: Implement the results screen** `mobile/app/results.tsx`:
  - On mount: `searchParts(year, make, model, part, trim)` once; `useState<SearchResponse | null>` + error flag; `deriveResultsState` picks the branch.
  - `loading`: 3 skeleton cards (gray blocks, `opacity` pulse via `Animated.loop`).
  - `error`: message + "Try again" button (re-runs the fetch).
  - `empty`: "No live listings found for this exact vehicle." — never fabricated results.
  - `stale`: amber banner "Live search failed — showing recent results" above the list.
  - `live`/`stale`: `FlatList` of `ListingCard`s; best value = `results[0]` (server already ranks), cheapest = lowest `price + (shippingCost ?? 0)`. Pull-to-refresh via `refreshControl` re-fetches.
  - Card `onPress` → `WebBrowser.openBrowserAsync(listing.link)` (`npx expo install expo-web-browser`) with `Haptics.selectionAsync()` first (`npx expo install expo-haptics`) — the in-app Safari view; full detail sheet arrives in Plan 2.

- [ ] **Step 7: Verify on device** — full journey: Search → vehicle → Brake Pads → skeletons → live eBay cards with real prices/badges → tap card opens in-app Safari → swipe back. Airplane mode → search → error state with retry. `npx tsc --noEmit` exits 0; `npm test` all green.

- [ ] **Step 8: Commit**

```powershell
git add mobile/app mobile/src
git commit -m "Add live results screen with listing cards"
```

---

### Task 9: End-to-end verification pass

**Files:**
- Create: `mobile/VERIFICATION.md` (checklist with results)

- [ ] **Step 1: Run the full suite**

```powershell
cd mobile; npm test; npx tsc --noEmit
```

Expected: all tests pass, tsc exits 0.

- [ ] **Step 2: On-device checklist** — record PASS/FAIL for each in `mobile/VERIFICATION.md`: three tabs render; garage persists across app restarts; year→make→model→trim flow with live NHTSA data; make/model search filtering; part grid + free-text part search; live results with badges and real prices; stale/error/empty states (airplane mode for error); in-app Safari opens and dismisses; dark mode (toggle in iOS Settings) restyles every screen; all tap targets comfortably thumb-sized.

- [ ] **Step 3: Commit**

```powershell
git add mobile/VERIFICATION.md
git commit -m "Record phase 0-1 on-device verification results"
```

---

## Follow-up plans (not in this document)

- **Plan 2:** Watchlist tab (persisted store + price deltas), listing detail sheet, compare flow, share sheet, haptics polish.
- **Plan 3:** EAS dev build; camera part-ID (`/api/identify-part`), VIN scan (ML Kit OCR); swap AsyncStorage → MMKV.
- **Plan 4:** Polish (Dynamic Type, offline cache of last results), store assets, EAS Build → TestFlight → EAS Submit.
