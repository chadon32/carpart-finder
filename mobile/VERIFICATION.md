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
