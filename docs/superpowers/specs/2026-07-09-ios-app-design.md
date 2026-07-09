# CarPartsRadar iOS App — Design

**Date:** 2026-07-09
**Status:** Approved by user (architecture, UX, and technical sections)

## Context

Transform the CarPartsRadar web app into a native-feeling iPhone app, targeting a
public App Store release. Constraints that shaped every decision:

- Development happens on a **Windows machine** — no Xcode, no local iOS builds.
- The user has an **iPhone** for testing and will enroll in the **Apple Developer
  Program ($99/yr)** for TestFlight/App Store.
- Explicit requirement: a true iOS experience, **not a webview wrapper**.
- v1 scope (user-selected): **core flow + native extras** — vehicle → part →
  live results → watchlist, plus camera part identification and VIN scanning.
  Accounts, push price alerts, AI repair guides, widgets, and Siri are v1.1+.

## Architecture decision

**Expo (React Native) with native iOS components.** Rationale:

- React Native renders real UIKit views (native navigation, sheets, haptics) —
  not a webview, so it clears the "no wrapper" bar and App Review guideline 4.2.
- **Only option workable end-to-end from Windows:** EAS Build compiles iOS
  binaries in the cloud; EAS Submit uploads to App Store Connect; Expo Go / EAS
  dev builds run on the user's iPhone for iteration. No Mac at any step.
- The whole existing stack is TypeScript/React — domain types (`Car`, `Part`,
  `Listing`), API contracts, and the just-shipped mobile web UX patterns
  transfer directly.

Rejected: **SwiftUI** (unbuildable/unverifiable without a Mac; remains open as a
future rewrite — the API layer serves either client), **Capacitor** (webview
wrapper, rejected by requirement and review risk), **Flutter** (new language,
zero code sharing, imitates rather than uses iOS).

## Product design (iOS experience)

Native tab bar, three tabs:

1. **Search** — native stack: garage header → vehicle picker → part picker →
   live results. Back-swipe, large titles, pull-to-refresh.
2. **Watchlist** — watched parts with price-drop deltas, swipe-to-delete,
   native empty state. Local-first (no accounts in v1).
3. **Garage** — saved vehicles as cards (photos from `/api/vehicle-image`),
   recalls badge per vehicle; app settings (theme, about, privacy) live here.

Key screens:

- **Vehicle picker:** full-screen searchable native lists for year/make/model
  (tap field → pushed list with search bar). VIN fast path: manual entry plus
  **camera VIN scan** (on-device OCR via ML Kit text recognition).
- **Part picker:** category grid + search; **"identify from photo"** camera
  button posting to the existing `/api/identify-part`.
- **Results:** FlashList virtualized cards; skeleton → card loading; long-press
  context menu (Watch / Share / Open on eBay); Best Value / Verified Fitment /
  Cheapest badges preserved. Filters in a native bottom sheet with detents.
- **Listing detail:** native sheet, sticky footer (Buy on eBay →
  SFSafariViewController in-app browser; Watch with haptic tick).
- **Compare:** floating bar above the tab bar when 2+ selected → full-screen
  compare sheet.

Native behaviors: haptics on watch/compare/scan-success; share sheet per
listing; native alerts; system dark mode; Dynamic Type; ≥44pt touch targets.

## Technical design

**Stack:** Expo SDK (latest stable), TypeScript, Expo Router (file-based native
navigation), FlashList, expo-image, Zustand + MMKV (state + persistence for
garage/watchlist/recent searches), expo-camera + ML Kit text recognition (VIN
scan; requires EAS dev build rather than Expo Go — needed for the Store
anyway), expo-haptics, expo-web-browser (SFSafariViewController).

**Structure:** `mobile/` directory in this repo; web app untouched.

```
mobile/
  app/                 # Expo Router routes
    (tabs)/search, (tabs)/watchlist, (tabs)/garage
    vehicle-picker, part-picker, results, listing/[id], compare, scan
  src/api/             # typed client for existing endpoints
  src/types/           # Car/Part/Listing mirrored from web (small, duplicated
                       #   deliberately — no monorepo tooling for v1)
  src/components/
  src/stores/
```

**Backend changes: nearly none.** Secrets already live server-side; the API
already accepts Origin-less native requests (verified by existing tests);
validation and rate limiting exist. Additions: the app sends
`X-App-Platform: ios` for traffic attribution. Bearer-token auth middleware
already exists for the v1.1 accounts work.

**Performance:** Hermes; single search request per results screen; expo-image
disk cache; debounced make/model search; offline = MMKV-cached last results +
watchlist/garage with an explicit "offline — showing last results" banner
(honesty guardrail carries over: never fabricate freshness).

**Security & privacy:** HTTPS-only (default ATS, no exceptions); no secrets in
the binary; truthful camera permission string ("Identify a part or scan your
VIN from a photo"); **no analytics/tracking SDK in v1** → minimal App Privacy
label. v1.1 accounts: tokens in Keychain (expo-secure-store), Apple Sign In
added alongside email login (required by Apple once third-party login exists).

**App Store readiness:** reuse the radar icon pipeline
(`scripts/generate-icons.mjs`) for the 1024pt icon; launch screen = brand
cobalt + RadarMark; eBay affiliate outbound links are compliant (physical
goods, 3.1.3(f) — no IAP); metadata/screenshots at submission; Apple Developer
Program enrollment required before TestFlight.

## Development phases

0. Scaffold + running on the user's iPhone via Expo Go, API connected.
1. Core flow: garage → vehicle picker → part picker → live results.
2. Watchlist, listing detail sheet, compare, share sheet, haptics.
3. Camera part-ID + VIN scan (switch to EAS dev build).
4. Polish: dark mode, offline states, performance pass, Dynamic Type.
5. Store assets, EAS Build → TestFlight → EAS Submit → App Review.

## Testing strategy

- Jest for pure logic (API mappers, price/shipping math, store logic).
- On-device verification checklist per phase (evidence-driven, same philosophy
  as `drive-mobile.mjs`); Maestro E2E automation is a later option.
- TestFlight on real hardware as the gate before submission.

## Deferred (v1.1+)

Accounts (Supabase must be configured in production first) + Apple Sign In +
watchlist sync; price-alert push notifications (APNs via Expo Notifications +
backend worker changes); AI repair guides; widgets; Siri shortcuts.
