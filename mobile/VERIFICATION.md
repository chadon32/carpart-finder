# Phase 0–1 Verification

## Automated (2026-07-09)

- [x] `npm test` — 11/11 passing (API client, garage store, results state)
- [x] `npx tsc --noEmit` — clean
- [x] `npx expo export --platform ios` — Hermes bundle builds (2.4 MB)

## On-device (Expo Go, iPhone)

- [ ] Three native tabs render (Search / Watchlist / Garage)
- [ ] Garage persists across app restarts
- [ ] Year → Make → Model → Trim flow with live NHTSA data
- [ ] Make/model search filtering works
- [ ] Part grid renders; free-text part search submits
- [ ] Live results show real prices with Best Value / Cheapest / Verified fitment badges
- [ ] Error state with retry (airplane mode), empty state honest
- [ ] Tapping a listing opens in-app Safari; swipe to dismiss
- [ ] Dark mode (iOS Settings) restyles every screen
- [ ] Tap targets comfortably thumb-sized

## Phase 2 — Automated (2026-07-09)

- [x] `npm test` — 19/19 passing (adds watchlist, compare, priceDelta, recents)
- [x] `npx tsc --noEmit` — clean
- [x] `npx expo export --platform ios` — bundle builds

## Phase 2 — On-device (dev build, iPhone)

- [ ] Tap a listing → detail sheet slides up; swipe-down dismisses
- [ ] Detail sheet: Buy opens in-app Safari; Watch toggles with haptic; Share opens share sheet
- [ ] Watching an item shows a count badge on the Watchlist tab
- [ ] Watchlist rows show price delta vs when added (or "—" when no live price)
- [ ] Remove from watchlist works; watchlist persists across restarts
- [ ] Compare: select 2+ → floating bar above tab bar; Compare screen scrolls columns; Clear resets
- [ ] Recent searches appear on Search home and re-run the search
- [ ] Dark mode across all new screens

## Phase 3 — Automated (2026-07-09)

- [x] `npm test` — 25/25 passing (adds extractVin, identify-part client)
- [x] `npx tsc --noEmit` — clean
- [x] EAS development build with camera modules — FINISHED (e2ed0dd8)
- [x] Data-URL fix verified against the API's identify-part validation

## Phase 3 — On-device (camera build)

- [ ] Part picker: "Identify from a photo" → camera → identified part lands on results
- [ ] Unidentifiable photo → honest "couldn't identify" message (no guessed part)
- [ ] Vehicle picker: VIN scan photo → decoded vehicle in garage (photo stays on device)
- [ ] Manual 17-char VIN entry decodes
- [ ] Camera permission denial shows the Settings hint

## Phase 4 — Store readiness (2026-07-09)

- [x] Branded 1024px app icon (radar mark on cobalt, no alpha) + splash
- [x] Privacy policy live at https://carpartsradar.com/privacy.html (HTTP 200)
- [x] Production build — FINISHED (buildNumber 2)
- [x] Uploaded to App Store Connect / TestFlight (user-confirmed submission)
- [ ] TestFlight install verified on device
- [ ] Screenshots captured for App Store listing
- [ ] Submit for App Review (user action in App Store Connect)

## Phase 5 — Automated (2026-07-09)

- [x] `npm test` — 35/35 passing (adds listingFilters, dtc lookup)
- [x] `npx tsc --noEmit` — clean
- [x] `npx expo export --platform ios` — bundle builds (all JS-only; hot-loads into existing builds)

## Phase 5 — On-device

- [ ] Results: Filters sheet (sort, min rating, condition, hide overseas); count badge; filtered-empty message; badges follow listings when re-sorted
- [ ] Part picker: "Describe the problem" → diagnosis matches with confidence pills → part chip → results
- [ ] Part picker: "OBD-II code" → P0302 shows definition + parts; junk input shows format error
- [ ] Garage: health icon → recalls (or honest error with retry) + typical-maintenance table; rows shop the part
- [ ] Results: "Repair guide" generates markdown guide with disclaimer
