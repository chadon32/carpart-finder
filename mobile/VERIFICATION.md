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
