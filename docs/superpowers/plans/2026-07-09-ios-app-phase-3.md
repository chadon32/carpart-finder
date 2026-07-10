# iOS App Phase 3 (Camera Part-ID + VIN Scan) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Identify a part by pointing the camera at it (existing `/api/identify-part`), and add a vehicle by scanning or typing its VIN (on-device ML Kit OCR + existing `/api/vin`).

**Architecture:** System camera via `expo-image-picker` (native UI, no custom camera screen), base64 photo to the production API for part-ID; for VIN, photo → on-device ML Kit text recognition → pure `extractVin` parser (TDD) → `/api/vin` decode → garage. Both features require native modules, so the phase ends with a new EAS development build.

**Tech Stack:** expo-image-picker, @react-native-ml-kit/text-recognition@2.0.0. **Spec deviation:** the MMKV swap is dropped — react-native-mmkv v4 requires an additional native runtime (nitro-modules) and our stores are tiny; AsyncStorage stays.

## Global Constraints

- Same as Phases 1–2 (API base + header, honesty guardrail — an unidentified photo says so plainly, never a guessed part; ≥44pt targets; dark mode; no analytics).
- Camera permission string must be truthful: "CarPartsRadar uses the camera to identify a part from a photo or scan your VIN."
- ML Kit runs on-device only in a dev build — Expo Go/web fallbacks are not required (we ship dev builds now).

---

### Task 1: Dependencies, permissions, identify-part client (TDD)

**Files:** Modify `mobile/app.json` (image-picker plugin + permission strings), `mobile/src/api/client.ts`, `mobile/src/api/__tests__/client.test.ts`.

**Interfaces:** `identifyPartFromImage(base64Image: string): Promise<{ identified: boolean; partName: string | null }>` — POST JSON `{ image }` with the platform header; throws server `error` message on non-OK.

- [ ] Install: `npx expo install expo-image-picker; npm i @react-native-ml-kit/text-recognition@2.0.0`
- [ ] `app.json` plugins: `["expo-image-picker", { "cameraPermission": "CarPartsRadar uses the camera to identify a part from a photo or scan your VIN." }]`
- [ ] Failing test:

```ts
test('identifyPartFromImage POSTs the photo', async () => {
  mockFetch.mockReturnValue(jsonResponse({ identified: true, partName: 'Brake Pads' }))
  const res = await identifyPartFromImage('b64')
  expect(res.partName).toBe('Brake Pads')
  const [url, init] = mockFetch.mock.calls[0]
  expect(url).toBe(`${API_BASE}/api/identify-part`)
  expect(init.method).toBe('POST')
  expect(JSON.parse(init.body).image).toBe('b64')
  expect(init.headers['X-App-Platform']).toBe('ios')
})
```

- [ ] Implement in `client.ts`:

```ts
export async function identifyPartFromImage(
  base64Image: string
): Promise<{ identified: boolean; partName: string | null }> {
  const res = await fetch(`${API_BASE}/api/identify-part`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Platform': 'ios' },
    body: JSON.stringify({ image: base64Image }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`)
  return data
}
```

- [ ] Tests green; commit "Add identify-part client and camera permission config".

---

### Task 2: extractVin parser (TDD)

**Files:** Create `mobile/src/lib/extractVin.ts`; test `mobile/src/lib/__tests__/extractVin.test.ts`.

**Interfaces:** `extractVin(ocrText: string): string | null` — returns the first valid-shaped VIN (17 chars, A–Z minus I/O/Q, digits) found in OCR text, uppercased; tolerates the VIN being split by spaces/newlines mid-token only when a clean 17-char token exists after stripping separators.

- [ ] Failing tests:

```ts
import { extractVin } from '../extractVin'

test('finds a clean VIN token', () =>
  expect(extractVin('VIN: 4T1BF1FK5FU123456 MADE IN JAPAN')).toBe('4T1BF1FK5FU123456'))
test('lowercase input is normalized', () =>
  expect(extractVin('4t1bf1fk5fu123456')).toBe('4T1BF1FK5FU123456'))
test('rejects tokens with I, O, or Q', () =>
  expect(extractVin('4T1BF1FK5FU12345O')).toBeNull())
test('finds VIN across a line break', () =>
  expect(extractVin('4T1BF1FK5\nFU123456')).toBe('4T1BF1FK5FU123456'))
test('returns null when nothing VIN-shaped', () =>
  expect(extractVin('TOYOTA CAMRY 2015')).toBeNull())
```

- [ ] Implement:

```ts
const VIN_CHARS = /^[A-HJ-NPR-Z0-9]{17}$/

// Returns the first 17-char VIN-shaped token in OCR text, or null. Tries raw
// tokens first, then the text with all whitespace stripped (labels often wrap
// the VIN across lines).
export function extractVin(ocrText: string): string | null {
  const upper = ocrText.toUpperCase()
  for (const token of upper.split(/[^A-Z0-9]+/)) {
    if (VIN_CHARS.test(token)) return token
  }
  const joined = upper.replace(/[^A-Z0-9]+/g, '')
  for (let i = 0; i + 17 <= joined.length; i++) {
    const slice = joined.slice(i, i + 17)
    if (VIN_CHARS.test(slice)) return slice
  }
  return null
}
```

- [ ] Tests green; commit "Add VIN extraction parser".

---

### Task 3: Identify-part camera flow in the part picker

**Files:** Modify `mobile/src/app/part-picker.tsx`.

- [ ] Add an "📷 Identify from a photo" card-button above POPULAR (≥50pt): `ImagePicker.launchCameraAsync({ base64: true, quality: 0.5 })` → if not canceled, set `identifying` state (spinner + "Identifying part…"), call `identifyPartFromImage(asset.base64)`. On `identified` → success haptic + `goToResults(partName)`. On `identified: false` → inline message "Couldn't identify the part — try a clearer photo or search by name." On throw → "Identification failed — check your connection." Never guess.
- [ ] Handle camera permission denial: `ImagePicker.requestCameraPermissionsAsync()` first; if denied, show inline note "Camera access is off — enable it in Settings."
- [ ] tsc green; commit "Camera part identification in part picker".

---

### Task 4: VIN entry + scan in the vehicle picker

**Files:** Modify `mobile/src/app/vehicle-picker.tsx`.

- [ ] Above the Year list (step 1 only), add a "HAVE YOUR VIN?" section: a VIN `TextInput` (autoCapitalize characters, maxLength 17, filters to VIN charset) with a **Decode** button (enabled at 17 chars), and a **Scan** button: camera photo → `TextRecognition.recognize(asset.uri)` (import `TextRecognition` from `@react-native-ml-kit/text-recognition`) → `extractVin(result.text)` → fill the input and auto-decode. No VIN found → "No VIN found in the photo — try closer, straight-on."
- [ ] Decode: `decodeVinApi(vin)` → on success `addVehicle({ year, make, model, trim: trim ?? '', vin })` and `router.replace('/part-picker', …)`; on 422/error show the server message inline.
- [ ] tsc green; commit "VIN entry and camera scan in vehicle picker".

---

### Task 5: New dev build + verification

- [ ] `npm test` (24+), `npx tsc --noEmit`, `npx expo export --platform ios` all green.
- [ ] Kick EAS dev build non-interactively (credentials exist from build 1): `npx eas-cli build --platform ios --profile development --non-interactive --no-wait`; monitor with `eas build:list`.
- [ ] User installs the new build from the EAS link (old install is replaced, data persists), then on-device checks appended to `mobile/VERIFICATION.md`: part photo → results for identified part; unidentifiable photo → honest message; VIN scan of a real VIN plate → decoded vehicle in garage; manual VIN decode; permission-denied path.
- [ ] Commit "Record phase 3 verification".
