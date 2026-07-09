# Mobile Experience Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn CarPartsRadar into a premium, app-like mobile experience: installable PWA, bottom tab bar, vaul bottom sheets, ≥44px touch targets, 16px mobile inputs, and mobile-first reworks of every surface — with the desktop appearance unchanged.

**Architecture:** Mobile primitives first (CSS foundation, `BottomNav`, sheet-capable `Modal`, `StickyActionBar`), then surface-by-surface redesign (CarSelector, PartSelector, ResultsList, ListingCard, modals, CartPanel, Dashboard). No router — the existing state machine in `App.tsx` stays. All mobile behavior branches at Tailwind's `sm:` boundary (640px).

**Tech Stack:** Vite + React 19 + TypeScript + Tailwind v4. New runtime dependency: `vaul` (bottom sheets). New dev dependency: `sharp` (icon generation script only).

**Spec:** `docs/superpowers/specs/2026-07-09-mobile-experience-design.md`

## Global Constraints

- **No service worker, no offline caching** — honesty guardrail: live prices must never be shown stale.
- **Desktop (`sm:`+) appearance unchanged** except: tap-toggleable tooltip (hover still works), Barlow font-weight trim, favicon swap.
- **Touch floors on `<640px`:** interactive controls ≥44px tall (`.btn`), ≥40px for compact pills; all text inputs ≥16px font (iOS zoom prevention).
- **Only new deps:** `vaul` (runtime), `sharp` (dev). Nothing else.
- **Tailwind v4 rule:** never `@apply` one custom component class inside another — compose variants in markup.
- **No fabricated data anywhere** (mock listings previously removed in 36348c5 — do not reintroduce).
- **No frontend unit-test harness exists.** Per-task verification = `npm run build` (tsc + vite) and `npm run lint` (oxlint), plus the behavior checks written into each task. `npm test` (server node:test) must still pass at the end.
- All paths relative to repo root. Windows shell; commands below run in Git Bash or PowerShell equivalently unless noted.

---

### Task 1: Mobile CSS foundation + viewport meta

**Files:**
- Modify: `index.html:8` (viewport meta), `index.html:10-11` (preconnects)
- Modify: `src/index.css` (html/body rules ~line 78-101; `@layer components` additions)

**Interfaces:**
- Produces: CSS utility `.pb-safe` (safe-area bottom padding), `.scrollbar-none` (hidden scrollbars on horizontal scroll rows). Mobile-only floors: `.btn` min-height 44px, `.btn-sm` 40px, `.chip`/`.filter-pill` ≥40px, `.tab` ≥44px, `.field` 16px font. Later tasks rely on these existing.

- [ ] **Step 1: Update viewport meta and add eBay image preconnect in `index.html`**

Replace line 8:

```html
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

After the two existing font preconnect lines (10-11), add:

```html
    <link rel="preconnect" href="https://i.ebayimg.com" />
```

- [ ] **Step 2: Add touch foundation to `src/index.css`**

In the existing `html { scroll-behavior... }` block (line 78), add two properties so it reads:

```css
html {
  scroll-behavior: smooth;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  -webkit-tap-highlight-color: transparent;
}
```

In the existing `body { ... }` block (line 85), add `overscroll-behavior-y: none;`:

```css
body {
  font-feature-settings: "cv11", "ss01", "ss03";
  overscroll-behavior-y: none;
  @apply text-slate-800 bg-slate-50 transition-colors duration-200;
}
```

- [ ] **Step 3: Add mobile utilities and touch-target floors inside `@layer components`**

Add at the top of the `@layer components` block (right after `@layer components {`):

```css
  /* Safe-area helper for fixed bottom UI (tab bar, sheets, sticky CTAs). */
  .pb-safe {
    padding-bottom: env(safe-area-inset-bottom);
  }

  /* Hide scrollbars on horizontal chip/tab rows while keeping scrollability. */
  .scrollbar-none {
    scrollbar-width: none;
  }
  .scrollbar-none::-webkit-scrollbar {
    display: none;
  }

  /* Touch-target floor: on phones every control reaches the 44px Apple /
     48dp Android standard (40px for compact pills) and text inputs render
     at 16px so iOS Safari doesn't force-zoom on focus. Desktop unchanged. */
  @media (max-width: 639px) {
    .btn {
      min-height: 44px;
    }
    .btn-sm {
      min-height: 40px;
    }
    .chip,
    .filter-pill {
      min-height: 40px;
      padding-top: 0.5rem;
      padding-bottom: 0.5rem;
    }
    .tab {
      min-height: 44px;
      padding-top: 0.625rem;
    }
    .field,
    textarea.field {
      font-size: 16px;
    }
  }
```

Also add `touch-manipulation` (Tailwind utility, kills double-tap-zoom delay) to the `@apply` list of `.btn` (line ~308), `.chip` (~291), `.filter-pill` (~394), and `.tab` (~377). Example for `.btn`:

```css
  .btn {
    @apply inline-flex touch-manipulation items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all duration-200 ease-out outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.975];
  }
```

- [ ] **Step 4: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed with no errors (warnings about chunk size are pre-existing and fine).

- [ ] **Step 5: Commit**

```bash
git add index.html src/index.css
git commit -m "Add mobile touch foundation: safe-area/scrollbar utilities, 44px targets, 16px inputs"
```

---

### Task 2: PWA manifest, icons, and brand favicon

**Files:**
- Create: `public/icon.svg` (master icon), `public/manifest.webmanifest`, `scripts/generate-icons.mjs`
- Create (generated): `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/maskable-512.png`, `public/apple-touch-icon.png`
- Modify: `index.html` (head: manifest + apple meta), `public/favicon.svg` (replace off-brand purple bolt with RadarMark)
- Check: `vercel.json` (CSP must not block same-origin manifest)

**Interfaces:**
- Produces: installable PWA. No code interfaces consumed by later tasks.

- [ ] **Step 1: Create `public/icon.svg`** — RadarMark (from `src/components/RadarMark.tsx`, static, white on cobalt gradient, full-bleed square; mark spans the central 360/512px so it sits inside the maskable safe zone):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1a43a8"/>
      <stop offset="1" stop-color="#122c6d"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g transform="translate(76 76) scale(15)" stroke="#ffffff" fill="none">
    <circle cx="12" cy="12" r="9.5" stroke-opacity="0.45" stroke-width="1.2"/>
    <circle cx="12" cy="12" r="5.5" stroke-opacity="0.25" stroke-width="1"/>
    <line x1="12" y1="2.5" x2="12" y2="21.5" stroke-opacity="0.14" stroke-width="1"/>
    <line x1="2.5" y1="12" x2="21.5" y2="12" stroke-opacity="0.14" stroke-width="1"/>
    <path d="M12 12 L4.72 5.89 A9.5 9.5 0 0 1 12 2.5 Z" fill="#ffffff" fill-opacity="0.28" stroke="none"/>
    <line x1="12" y1="12" x2="12" y2="2.5" stroke-width="1.4" stroke-linecap="round"/>
    <circle cx="16.4" cy="8.2" r="1.5" fill="#ffffff" stroke="none"/>
  </g>
</svg>
```

- [ ] **Step 2: Replace `public/favicon.svg`** (currently an off-brand purple lightning bolt) with a rounded-square version of the same mark:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1a43a8"/>
      <stop offset="1" stop-color="#122c6d"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="104" fill="url(#bg)"/>
  <g transform="translate(52 52) scale(17)" stroke="#ffffff" fill="none">
    <circle cx="12" cy="12" r="9.5" stroke-opacity="0.45" stroke-width="1.2"/>
    <circle cx="12" cy="12" r="5.5" stroke-opacity="0.25" stroke-width="1"/>
    <line x1="12" y1="2.5" x2="12" y2="21.5" stroke-opacity="0.14" stroke-width="1"/>
    <line x1="2.5" y1="12" x2="21.5" y2="12" stroke-opacity="0.14" stroke-width="1"/>
    <path d="M12 12 L4.72 5.89 A9.5 9.5 0 0 1 12 2.5 Z" fill="#ffffff" fill-opacity="0.28" stroke="none"/>
    <line x1="12" y1="12" x2="12" y2="2.5" stroke-width="1.4" stroke-linecap="round"/>
    <circle cx="16.4" cy="8.2" r="1.5" fill="#ffffff" stroke="none"/>
  </g>
</svg>
```

- [ ] **Step 3: Create `public/manifest.webmanifest`**

```json
{
  "name": "CarPartsRadar",
  "short_name": "PartsRadar",
  "description": "Compare live car part prices with verified fitment for your exact vehicle.",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#2050c8",
  "background_color": "#fafafa",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 4: Install sharp and create `scripts/generate-icons.mjs`**

Run: `npm i -D sharp`

```js
// Regenerates PWA PNG icons from public/icon.svg. Run: node scripts/generate-icons.mjs
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

await mkdir('public/icons', { recursive: true })

const outputs = [
  ['public/icons/icon-192.png', 192],
  ['public/icons/icon-512.png', 512],
  ['public/icons/maskable-512.png', 512],
  ['public/apple-touch-icon.png', 180],
]

for (const [file, size] of outputs) {
  await sharp('public/icon.svg', { density: 300 }).resize(size, size).png().toFile(file)
  console.log(`wrote ${file} (${size}x${size})`)
}
```

Run: `node scripts/generate-icons.mjs`
Expected: four "wrote ..." lines; the four PNGs exist.

- [ ] **Step 5: Wire up `index.html`** — after the favicon link (line 7), add:

```html
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="PartsRadar" />
```

- [ ] **Step 6: Check `vercel.json` CSP** — read the CSP header. If it contains `default-src 'self'` (or no `manifest-src` restriction), the same-origin manifest is fine — change nothing. Only if a restrictive `manifest-src` exists must `'self'` be added to it.

- [ ] **Step 7: Verify** — `npm run build`, then confirm `dist/manifest.webmanifest` and `dist/icons/icon-192.png` exist (Vite copies `public/` verbatim).

- [ ] **Step 8: Commit**

```bash
git add public/ scripts/generate-icons.mjs index.html package.json package-lock.json
git commit -m "Add installable PWA: manifest, RadarMark icons, apple meta; replace off-brand favicon"
```

---

### Task 3: `useIsMobile` hook + sheet-capable Modal (vaul)

**Files:**
- Create: `src/hooks/useIsMobile.ts`
- Modify: `src/components/Modal.tsx` (entire file shown below)

**Interfaces:**
- Consumes: `.pb-safe` from Task 1.
- Produces: `useIsMobile(): boolean` (true under 640px, reactive). `Modal` keeps its exact API `{ label, onClose, children, maxWidth? }` — every existing consumer works unchanged; under 640px it renders as a vaul bottom sheet (`maxWidth` ignored there).

- [ ] **Step 1: Install vaul**

Run: `npm i vaul`
Expected: adds `vaul` (^1.x) to dependencies.

- [ ] **Step 2: Create `src/hooks/useIsMobile.ts`**

```ts
import { useEffect, useState } from 'react'

// Below Tailwind's `sm:` breakpoint — the app's single mobile/desktop boundary.
const QUERY = '(max-width: 639px)'

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(QUERY).matches)

  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
```

- [ ] **Step 3: Rework `src/components/Modal.tsx`** — full new contents (the desktop branch is the existing code, unchanged):

```tsx
import { useEffect, useRef, type ReactNode } from 'react'
import { Drawer } from 'vaul'
import { useIsMobile } from '../hooks/useIsMobile'

// Accessible modal shell shared by every dialog in the app.
// Desktop (>=640px): centered dialog with its own focus trap, Escape,
// backdrop close, and body scroll lock. Mobile (<640px): a vaul bottom
// sheet — drag handle, swipe-down dismiss, safe-area padding; vaul/Radix
// supplies dialog semantics, focus management, and scroll lock there.
// `maxWidth` only applies to the desktop dialog; sheets are full-width.
export function Modal({
  label,
  onClose,
  children,
  maxWidth = 'max-w-2xl',
}: {
  label: string
  onClose: () => void
  children: ReactNode
  maxWidth?: string
}) {
  const isMobile = useIsMobile()
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isMobile) return
    restoreRef.current = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
      restoreRef.current?.focus?.()
    }
  }, [isMobile])

  if (isMobile) {
    return (
      <Drawer.Root open onOpenChange={(open) => { if (!open) onClose() }}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[2px]" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-3xl bg-white outline-none dark:bg-slate-900">
            <Drawer.Title className="sr-only">{label}</Drawer.Title>
            <div aria-hidden className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-slate-300 dark:bg-slate-700" />
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-safe">
              {children}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !panelRef.current) return
    const focusables = panelRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-slate-950/45 backdrop-blur-[2px] px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[90vh] w-full ${maxWidth} animate-slide-up overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-100 outline-none`}
      >
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify** — `npm run build && npm run lint` pass. Then start `npm run dev:all`, open http://localhost:5173 in a 375px-wide viewport, run a search, tap a listing: the detail view must open as a bottom sheet with a drag handle and dismiss by swiping down / tapping the backdrop. At desktop width it must look exactly as before.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useIsMobile.ts src/components/Modal.tsx package.json package-lock.json
git commit -m "Render modals as vaul bottom sheets on mobile, centered dialogs on desktop"
```

---

### Task 4: BottomNav + App.tsx integration (header slim-down, hero compression, compare-bar offset)

**Files:**
- Create: `src/components/BottomNav.tsx`
- Modify: `src/App.tsx` (header buttons ~106-141, main ~145, hero ~176-204, render BottomNav before footer)
- Modify: `src/components/ResultsList.tsx:697` (compare bar bottom offset)

**Interfaces:**
- Consumes: `.pb-safe`, `.scrollbar-none` (Task 1).
- Produces: `BottomNav` with props `{ active: 'search' | 'watchlist' | 'account', watchlistCount: number, onSearch(): void, onWatchlist(): void, onAccount(): void }`. Fixed heights later tasks rely on: tab bar content = `h-14` (3.5rem) + safe inset; `<main>` mobile bottom padding = `4.5rem` + safe inset.

- [ ] **Step 1: Create `src/components/BottomNav.tsx`**

```tsx
import { Bookmark, Search, User as UserIcon } from 'lucide-react'

export type BottomTab = 'search' | 'watchlist' | 'account'

// Mobile-only primary navigation: fixed, thumb-reachable, mirrors the
// header's frosted treatment. Desktop keeps the header buttons instead.
export function BottomNav({
  active,
  watchlistCount,
  onSearch,
  onWatchlist,
  onAccount,
}: {
  active: BottomTab
  watchlistCount: number
  onSearch: () => void
  onWatchlist: () => void
  onAccount: () => void
}) {
  const tabs = [
    { id: 'search' as const, label: 'Search', icon: Search, onClick: onSearch },
    { id: 'watchlist' as const, label: 'Watchlist', icon: Bookmark, onClick: onWatchlist },
    { id: 'account' as const, label: 'Account', icon: UserIcon, onClick: onAccount },
  ]

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/70 bg-white/95 pb-safe backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/95 sm:hidden"
    >
      <div className="grid h-14 grid-cols-3">
        {tabs.map((t) => {
          const isActive = active === t.id
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              onClick={t.onClick}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex touch-manipulation flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <span className="relative">
                <Icon size={21} strokeWidth={isActive ? 2.4 : 2} />
                {t.id === 'watchlist' && watchlistCount > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[9px] font-bold text-white">
                    {watchlistCount}
                  </span>
                )}
              </span>
              <span className="font-data text-[10px] font-semibold uppercase tracking-[0.08em]">{t.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Integrate in `src/App.tsx`**

Add import: `import { BottomNav } from './components/BottomNav'`

Add a tab handler above the `return` (next to `goHome`):

```tsx
  // Bottom-nav Search tab: from watchlist/account, return to wherever the
  // search flow was; if already on the search flow, go home (native re-tap
  // convention).
  const goToSearchTab = () => {
    if (showWatchlist) {
      setShowWatchlist(false)
      return
    }
    if (step === 'dashboard') {
      if (car && part) setStep('results')
      else if (car) setStep('part')
      else setStep('car')
      return
    }
    goHome()
  }
```

Header: on the Watchlist button (line ~110) change `className="btn btn-secondary relative px-3 py-2.5 text-sm sm:px-4"` to `className="btn btn-secondary relative hidden px-3 py-2.5 text-sm sm:inline-flex sm:px-4"`. On the Account button (~127) change `` className={`btn flex items-center gap-2 px-3 py-2.5 text-sm sm:px-4 ...`} `` to `` className={`btn hidden items-center gap-2 px-3 py-2.5 text-sm sm:inline-flex sm:px-4 ...`} ``. Theme toggle unchanged.

Main (line 145): `className="mx-auto w-full max-w-6xl flex-1 px-5 pb-10 pt-8 sm:px-6"` → `className="mx-auto w-full max-w-6xl flex-1 px-5 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-8 sm:px-6 sm:pb-10"`

Render before the closing `</div>` of the app (after `</footer>`):

```tsx
      <BottomNav
        active={showWatchlist ? 'watchlist' : step === 'dashboard' ? 'account' : 'search'}
        watchlistCount={watchlist.items.length}
        onSearch={goToSearchTab}
        onWatchlist={() => setShowWatchlist(true)}
        onAccount={() => {
          setStep('dashboard')
          setShowWatchlist(false)
        }}
      />
```

- [ ] **Step 3: Compress the hero on mobile (`src/App.tsx` lines 176-204)**

- Hero wrapper (176): `"blueprint-grid relative mb-12 pt-6 text-center sm:mb-16 sm:pt-10"` → `"blueprint-grid relative mb-10 pt-4 text-center sm:mb-16 sm:pt-10"`
- Live badge (177): `mb-7` → `mb-5 sm:mb-7`
- H1 (182): `text-5xl` → `text-4xl` (keep `sm:text-7xl md:text-8xl`)
- Paragraph (188): `mt-6` → `mt-4 sm:mt-6`
- Chips row (193): `"animate-slide-up mt-8 flex flex-wrap items-center justify-center gap-2.5 [animation-delay:260ms]"` → `"animate-slide-up -mx-5 mt-6 flex items-center gap-2.5 overflow-x-auto scrollbar-none px-5 sm:mx-0 sm:mt-8 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0 [animation-delay:260ms]"` and add `shrink-0 whitespace-nowrap` to each of the three chip `div`s' class lists.

- [ ] **Step 4: Lift the compare bar above the tab bar (`src/components/ResultsList.tsx:697`)**

`"fixed bottom-6 left-1/2 z-40 ..."` → `"fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 z-40 sm:bottom-6 ..."` (rest of the class list unchanged).

- [ ] **Step 5: Verify** — `npm run build && npm run lint`. Dev server at 375px: tab bar visible with three labeled tabs; header shows only logo + theme toggle; tapping tabs switches Search/Watchlist/Account and highlights the active one; watchlist badge counts; hero fits with the vehicle card's top edge visible at 375×667; footer text not hidden behind the bar. At ≥640px: no tab bar, header identical to before.

- [ ] **Step 6: Commit**

```bash
git add src/components/BottomNav.tsx src/App.tsx src/components/ResultsList.tsx
git commit -m "Add mobile bottom tab bar, slim mobile header, compress hero, lift compare bar"
```

---

### Task 5: StickyActionBar + CarSelector touch fixes

**Files:**
- Create: `src/components/StickyActionBar.tsx`
- Modify: `src/components/CarSelector.tsx` (garage buttons ~270-289, vehicle-type buttons ~340, VIN input ~308-319, trim buttons ~406/419, trim clear ~390, sticky CTA near ~503)

**Interfaces:**
- Consumes: BottomNav height 3.5rem (Task 4), `.pb-safe` (Task 1).
- Produces: `StickyActionBar({ children: ReactNode })` — mobile-only fixed bar directly above BottomNav. Reusable by any step view.

- [ ] **Step 1: Create `src/components/StickyActionBar.tsx`**

```tsx
import type { ReactNode } from 'react'

// Mobile-only sticky bar floating directly above the BottomNav (h-14 =
// 3.5rem), keeping a step's primary call-to-action within thumb reach.
export function StickyActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-slate-200/70 bg-white/95 px-4 py-2.5 backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/95 sm:hidden">
      {children}
    </div>
  )
}
```

- [ ] **Step 2: CarSelector — sticky CTA.** Import `StickyActionBar`. The existing "Continue to parts" button (line ~503) stays. After it (before the `healthIndex` modal block), add:

```tsx
      {canConfirm && (
        <StickyActionBar>
          <button
            type="button"
            onClick={() => onConfirm({ year, make, model, trim: trim.trim() })}
            className="btn btn-primary btn-lg w-full"
          >
            Continue to parts
            <ArrowRight size={16} strokeWidth={2.4} />
          </button>
        </StickyActionBar>
      )}
```

- [ ] **Step 3: CarSelector — touch targets.**
- Garage Activity button (~277): `className="rounded p-1 text-slate-300 ..."` → `className="rounded-lg p-3 -m-1.5 text-slate-300 ..."` and `<Activity size={13} />` → `<Activity size={16} />`
- Garage remove button (~283): same padding change; `<X size={13} />` → `<X size={16} />`
- Vehicle-type buttons (~340): `rounded-lg px-3.5 py-1.5 text-sm` → `rounded-lg px-3.5 py-2.5 text-sm sm:py-1.5`
- Trim buttons — both the "Any trim" button (~406) and mapped trim buttons (~419): `px-4 py-2.5` → `px-4 py-3 sm:py-2.5`
- Trim "Clear selection" link (~390): add `py-2 -my-2` to its class list.

- [ ] **Step 4: CarSelector — VIN input attributes (~308).** Add to the `<input id="vin-input">`: `autoCapitalize="characters" autoCorrect="off" spellCheck={false} enterKeyHint="go"`.

- [ ] **Step 5: Verify** — `npm run build && npm run lint`. Dev at 375px: picking year/make/model makes a sticky "Continue to parts" bar appear above the tab bar; tapping it advances; garage icons comfortably tappable. Desktop: no sticky bar, layout unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/components/StickyActionBar.tsx src/components/CarSelector.tsx
git commit -m "Add sticky mobile CTA to vehicle step and fix CarSelector touch targets"
```

---

### Task 6: PartSelector — scrollable tabs, quote rows, chips

**Files:**
- Modify: `src/index.css` (`.tab` rule ~377), `src/components/PartSelector.tsx` (tab row ~391-427, example chips ~450-464, quote rows ~597-643)

**Interfaces:**
- Consumes: `.scrollbar-none` (Task 1).
- Produces: `.tab` becomes `shrink-0` + `sm:flex-1` (Dashboard's two tabs keep desktop look; on mobile they size to content — acceptable per spec).

- [ ] **Step 1: Make `.tab` scroll-friendly in `src/index.css`** — replace the `.tab` rule:

```css
  .tab {
    @apply shrink-0 touch-manipulation whitespace-nowrap border-b-2 border-transparent px-4 pb-2.5 text-center text-xs font-semibold text-slate-500 transition hover:text-slate-700 sm:flex-1;
  }
```

(The mobile `min-height`/`padding-top` from Task 1 still applies.)

- [ ] **Step 2: PartSelector tab row (~391)** — make it horizontally scrollable:

`className="mt-6 mb-5 flex border-b border-slate-100 dark:border-slate-800/60"` → `className="-mx-7 mb-5 mt-6 flex snap-x overflow-x-auto scrollbar-none border-b border-slate-100 px-7 dark:border-slate-800/60 sm:mx-0 sm:px-0"` and add `snap-start` to each of the five tab buttons' class lists (e.g. `className={\`tab snap-start ${searchMethod === 'name' ? 'tab-active' : ''}\`}`).

- [ ] **Step 3: Symptom example chips (~450)** — `className="flex flex-wrap gap-1.5"` → `className="-mx-1 flex gap-1.5 overflow-x-auto scrollbar-none px-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"` and add `shrink-0 whitespace-nowrap` to the chip buttons' class (`className="chip shrink-0 whitespace-nowrap text-[11px]"`).

- [ ] **Step 4: Quote item rows (~599)** — actions stack below content on mobile:
- `<li className="flex items-center gap-3 px-4 py-3">` → `<li className="flex flex-wrap items-center gap-3 px-4 py-3">`
- Actions container `<div className="flex shrink-0 flex-col gap-1">` → `<div className="flex w-full gap-2 sm:w-auto sm:shrink-0 sm:flex-col sm:gap-1">`
- "All listings" button: add `flex-1 sm:flex-none` to its class list; the "View" link: add `flex-1 sm:flex-none justify-center`.

- [ ] **Step 5: Verify** — `npm run build && npm run lint`. Dev at 375px: all five part tabs readable in one row that scrolls horizontally with no visible scrollbar and no wrapping; symptom examples scroll horizontally; run a diagnosis ("grinding noise when braking"), get a quote — quote-row buttons form a full-width row under each item. Dashboard (Account → sign-in screen renders; if signed in, tabs still look right). Desktop: tabs fill the width as before.

- [ ] **Step 6: Commit**

```bash
git add src/index.css src/components/PartSelector.tsx
git commit -m "Make part-selector tabs and chips horizontally scrollable on mobile"
```

---

### Task 7: ResultsList — mobile toolbar, FilterSheet, header actions

**Files:**
- Create: `src/components/FilterSheet.tsx`
- Modify: `src/components/ResultsList.tsx` (imports; header row ~267-341; toolbar ~406-496)

**Interfaces:**
- Consumes: `Modal` (sheet on mobile, Task 3).
- Produces: `FilterSheet` with props:
  ```ts
  {
    condition: 'all' | 'new' | 'used'
    onCondition: (c: 'all' | 'new' | 'used') => void
    hideOverseas: boolean
    onHideOverseas: (v: boolean) => void
    fastDelivery: boolean
    onFastDelivery: (v: boolean) => void
    minRating: number
    onMinRating: (v: number) => void
    zipInput: string
    onZipInput: (v: string) => void
    onCommitZip: () => void
    onClearAll: () => void
    onClose: () => void
  }
  ```

- [ ] **Step 1: Create `src/components/FilterSheet.tsx`**

```tsx
import { X } from 'lucide-react'
import { Modal } from './Modal'

type ConditionFilter = 'all' | 'new' | 'used'

// Mobile-first filter panel for the results list. Rendered through Modal, so
// it opens as a bottom sheet on phones and a centered dialog on desktop.
// All state lives in ResultsList (persisted); this is a pure control surface.
export function FilterSheet({
  condition,
  onCondition,
  hideOverseas,
  onHideOverseas,
  fastDelivery,
  onFastDelivery,
  minRating,
  onMinRating,
  zipInput,
  onZipInput,
  onCommitZip,
  onClearAll,
  onClose,
}: {
  condition: ConditionFilter
  onCondition: (c: ConditionFilter) => void
  hideOverseas: boolean
  onHideOverseas: (v: boolean) => void
  fastDelivery: boolean
  onFastDelivery: (v: boolean) => void
  minRating: number
  onMinRating: (v: number) => void
  zipInput: string
  onZipInput: (v: string) => void
  onCommitZip: () => void
  onClearAll: () => void
  onClose: () => void
}) {
  return (
    <Modal label="Filter listings" onClose={onClose} maxWidth="max-w-md">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800/60">
        <h3 className="section-title text-lg">Filters</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close filters"
          className="hidden rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 sm:block"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-5 px-5 py-5">
        <div>
          <div className="field-label">Condition</div>
          <div className="inline-flex gap-0.5 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
            {(['all', 'new', 'used'] as ConditionFilter[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onCondition(c)}
                className={`min-h-[40px] rounded-full px-5 text-xs font-semibold capitalize transition ${
                  condition === c ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600'
                }`}
              >
                {c === 'all' ? 'All' : c}
              </button>
            ))}
          </div>
        </div>

        <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Hide overseas listings</span>
          <input
            type="checkbox"
            checked={hideOverseas}
            onChange={(e) => onHideOverseas(e.target.checked)}
            className="h-5 w-5 accent-brand-600"
          />
        </label>

        <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Arrives within a week</span>
          <input
            type="checkbox"
            checked={fastDelivery}
            onChange={(e) => onFastDelivery(e.target.checked)}
            className="h-5 w-5 accent-brand-600"
          />
        </label>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="field-label mb-0">Minimum seller rating</span>
            <span className="font-data text-sm font-semibold text-slate-700 dark:text-slate-300">{minRating}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={minRating}
            onChange={(e) => onMinRating(Number(e.target.value))}
            aria-label="Minimum seller rating percentage"
            className="h-8 w-full accent-brand-600"
          />
        </div>

        <div>
          <label htmlFor="filter-zip" className="field-label">Delivery ZIP code</label>
          <input
            id="filter-zip"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            enterKeyHint="done"
            maxLength={5}
            value={zipInput}
            onChange={(e) => onZipInput(e.target.value.replace(/\D/g, ''))}
            onBlur={onCommitZip}
            placeholder="e.g. 90210"
            className="field"
          />
          <p className="mt-1.5 text-xs text-slate-500">Used for delivery estimates on each listing.</p>
        </div>
      </div>

      <div className="flex gap-3 border-t border-slate-100 px-5 py-4 dark:border-slate-800/60">
        <button type="button" onClick={onClearAll} className="btn btn-secondary flex-1">
          Clear all
        </button>
        <button type="button" onClick={onClose} className="btn btn-primary flex-1">
          Show results
        </button>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 2: Wire it into `ResultsList.tsx`**

Imports: add `SlidersHorizontal` to the lucide import list, `import { toast } from 'sonner'`, and `import { FilterSheet } from './FilterSheet'`.

State (next to `showCompareModal`): `const [showFilters, setShowFilters] = useState(false)`

Derived count (next to `priceRange` memo):

```tsx
  const activeFilterCount =
    (condition !== 'all' ? 1 : 0) +
    (hideOverseas ? 1 : 0) +
    (filterFastDelivery ? 1 : 0) +
    (minRating > 0 ? 1 : 0) +
    (effectiveZip ? 1 : 0)
```

A shared clear handler (the same reset is currently inlined twice at ~515 and ~542 — extract and reuse in both places plus the sheet):

```tsx
  const clearFilters = () => {
    setCondition('all')
    setHideOverseas(false)
    setFilterFastDelivery(false)
    setMinRating(0)
    setZip('')
  }
```

- [ ] **Step 3: Split the toolbar (~406).** Wrap the existing toolbar `div` (the one starting `<div className="mt-6 flex flex-wrap items-center justify-between gap-3">`) so the current contents become desktop-only, and add a mobile row before it:

```tsx
          {/* Mobile toolbar: one thumb-scrollable row; detail filters live in the sheet */}
          <div className="-mx-6 mt-6 flex items-center gap-2 overflow-x-auto scrollbar-none px-6 sm:hidden">
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              className="btn btn-secondary relative shrink-0 px-4 text-xs"
            >
              <SlidersHorizontal size={15} /> Filters
              {activeFilterCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <div className="inline-flex shrink-0 gap-0.5 rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
              {(['all', 'new', 'used'] as ConditionFilter[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCondition(c)}
                  className={`min-h-[38px] rounded-full px-4 text-xs font-semibold capitalize transition ${condition === c ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600'}`}
                >
                  {c === 'all' ? 'All' : c}
                </button>
              ))}
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              aria-label="Sort listings"
              className="field w-auto shrink-0 py-2.5 pr-8 text-xs font-semibold"
            >
              <option value="price">Cheapest first</option>
              <option value="value">Best value</option>
              <option value="rating">Seller rating</option>
            </select>
          </div>
```

Then change the existing toolbar's class from `"mt-6 flex flex-wrap items-center justify-between gap-3"` to `"mt-6 hidden flex-wrap items-center justify-between gap-3 sm:flex"`. Replace both inline clear-filter `onClick` bodies (~515, ~542) with `onClick={clearFilters}`.

At the bottom (next to the other modals, after `showCompareModal` block), render:

```tsx
      {showFilters && (
        <FilterSheet
          condition={condition}
          onCondition={setCondition}
          hideOverseas={hideOverseas}
          onHideOverseas={setHideOverseas}
          fastDelivery={filterFastDelivery}
          onFastDelivery={setFilterFastDelivery}
          minRating={minRating}
          onMinRating={setMinRating}
          zipInput={zipInput}
          onZipInput={setZipInput}
          onCommitZip={() => {
            if (zipInput === '' || /^\d{5}$/.test(zipInput)) setZip(zipInput)
          }}
          onClearAll={clearFilters}
          onClose={() => setShowFilters(false)}
        />
      )}
```

- [ ] **Step 4: Header actions (~282-341).**
- "Part" back button: `className="btn btn-ghost px-2.5 py-1.5"` → `className="btn btn-ghost px-2.5 py-1.5"` stays, but label becomes `<ChevronLeft size={16} /> <span>Part</span>` (no change needed beyond sizing, which Task 1's min-height covers).
- "Vehicle" back button: add `hidden sm:inline-flex` to its class list (mobile relies on the Part back + logo/tab bar).
- Save Search button: change its label span so text hides on mobile and add an icon + aria-label + toast feedback. Add `Bell` → no; use `BookmarkPlus` from lucide (add to import). New button body:

```tsx
            <BookmarkPlus size={15} className="sm:hidden" />
            <span className="hidden sm:inline">
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved!' : saveState === 'auth' ? 'Log in to save' : saveState === 'error' ? "Couldn't save — try again" : 'Save Search'}
            </span>
```

and add `aria-label="Save search"` to the button. In the save handler, after `setSaveState('saved')` add `toast.success('Search saved')`, and in the catch after `setSaveState(...)` add `toast.error(isAuth ? 'Log in to save searches' : "Couldn't save — try again")`. (Keep the `saveState === 'saved' && <Check .../>` icon line — it shows on both.)
- Share button: wrap the text in `<span className="hidden sm:inline">{copied ? 'Copied!' : 'Share'}</span>` and add `aria-label="Copy share link"`.

- [ ] **Step 5: Verify** — `npm run build && npm run lint`. Dev at 375px on a results page: single-row toolbar scrolls horizontally; Filters opens a bottom sheet; toggling filters updates the list live and the badge count; Clear all resets everything including ZIP; sort select works; Save/Share are icon buttons that toast. Desktop: toolbar pixel-identical to before; no Filters button.

- [ ] **Step 6: Commit**

```bash
git add src/components/FilterSheet.tsx src/components/ResultsList.tsx
git commit -m "Add mobile filter sheet and one-row results toolbar"
```

---

### Task 8: ListingCard — mobile actions, tap-toggle tooltip, details affordance

**Files:**
- Modify: `src/components/ListingCard.tsx` (whole action row ~138-163, Best Value badge ~124-132, price block ~81-92, image ~48-61)

**Interfaces:**
- Consumes: nothing new. Produces: nothing consumed elsewhere.

- [ ] **Step 1: Convert to a stateful component for the tooltip.** Add at top: `import { useState } from 'react'` and `ChevronRight` to the lucide import. Inside the component: `const [showValueInfo, setShowValueInfo] = useState(false)`.

- [ ] **Step 2: Replace the hover-only Best Value badge (~124-132)** with a tap/click-toggleable version (hover still shows it on desktop via the badge's own `group` class):

```tsx
          {isBestValue && (
            <span className="group relative badge bg-emerald-100 text-emerald-800 p-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowValueInfo((v) => !v)
                }}
                aria-expanded={showValueInfo}
                aria-describedby={`bv-tip-${listing.id}`}
                className="inline-flex touch-manipulation items-center gap-1 px-2.5 py-1.5"
              >
                <Sparkles size={12} /> Recommended (Best Value)
              </button>
              <span
                id={`bv-tip-${listing.id}`}
                role="tooltip"
                className={`pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-xl bg-slate-950 px-3 py-2 text-[10px] font-normal leading-normal text-white shadow-xl transition-all duration-200 ${showValueInfo ? 'opacity-100' : 'opacity-0'} sm:group-hover:opacity-100`}
              >
                <strong>Best Value Deal:</strong> Calculated by weighing total price (with shipping), seller feedback, and vehicle fitment compatibility.
                <span className="absolute top-full left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1 bg-slate-950 rotate-45" />
              </span>
            </span>
          )}
```

- [ ] **Step 3: Mobile "Details" affordance in the price block (~81-92).** After the `Total: $...` div, add:

```tsx
            <button
              type="button"
              onClick={() => onSelect(listing)}
              className="mt-1 inline-flex touch-manipulation items-center gap-0.5 py-1.5 text-[11px] font-semibold text-brand-600 dark:text-brand-400 sm:hidden"
            >
              Details <ChevronRight size={12} />
            </button>
```

- [ ] **Step 4: Action row (~138-163)** — replace with:

```tsx
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={listing.link} target="_blank" rel="noopener noreferrer" className="btn btn-primary flex-1 px-4 py-2 text-sm sm:flex-none sm:px-5">
            Buy on {listing.source} <ExternalLink size={14} />
          </a>
          <button
            type="button"
            onClick={() => onSelect(listing)}
            className="btn btn-secondary hidden px-5 py-2 text-sm sm:inline-flex"
          >
            Click for Detailed View
          </button>
          <button
            type="button"
            disabled={inWatchlist}
            onClick={() => onAddToWatchlist(listing)}
            className={`btn px-4 py-2 text-sm sm:px-5 ${inWatchlist ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'btn-secondary'}`}
          >
            {inWatchlist ? <><Check size={15} /> Watching</> : <><Plus size={15} /> <span className="sm:hidden">Watch</span><span className="hidden sm:inline">Watch part</span></>}
          </button>
          <button
            onClick={() => onToggleCompare(listing)}
            className="btn btn-ghost px-4 py-2 text-sm"
          >
            {isComparing ? 'Remove' : 'Compare'}
          </button>
        </div>
```

- [ ] **Step 5: Image tweaks (~48-61).** On the `<img>` add `decoding="async"`; change `h-24 w-24` to `h-20 w-20 sm:h-24 sm:w-24` on both the img and its no-image fallback div.

- [ ] **Step 6: Verify** — `npm run build && npm run lint`. Dev at 375px: Buy stretches, Watch/Compare beside it, all ≥44px; "Details ›" under the price opens the sheet; tapping the Best Value badge toggles its explanation; no hover-dependent info left. Desktop: 4 buttons as before, tooltip appears on hover.

- [ ] **Step 7: Commit**

```bash
git add src/components/ListingCard.tsx
git commit -m "Mobile-first listing card actions, tappable best-value tooltip, details affordance"
```

---

### Task 9: PartDetailModal sticky footer + CartPanel + Dashboard sweep

**Files:**
- Modify: `src/components/PartDetailModal.tsx` (footer ~155-179, header X ~43), `src/components/CartPanel.tsx` (header ~148-164, rows ~193-232, totals ~234-248), `src/components/Dashboard.tsx` (back buttons ~116, ~236-241)

**Interfaces:** none new.

- [ ] **Step 1: PartDetailModal footer (~155)** — sticky inside the sheet, safe-area aware, Close hidden on mobile (drag/backdrop dismisses):

```tsx
        <div className="sticky bottom-0 mt-4 flex flex-col gap-3 border-t bg-slate-50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:static sm:flex-row sm:p-6">
```

(replace the old wrapper class `"flex flex-col gap-3 border-t bg-slate-50 p-6 sm:flex-row mt-4"`; the three buttons inside are unchanged except the Close button gets `hidden sm:inline-flex` added: `className="btn btn-ghost hidden py-3 text-base sm:inline-flex"`.)

Header close X (~43): `p-2` → `p-2.5`.

- [ ] **Step 2: CartPanel.**
- Header "Search" back button (~161): add `hidden sm:inline-flex` (tab bar covers it on mobile). "Compare"/"Check prices" buttons: leave (Task 1 sizes them).
- Item row `<li>` (~195): `"flex items-center gap-4 rounded-2xl border border-slate-200 p-3 transition hover:border-slate-300"` → `"flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 p-3 transition hover:border-slate-300 sm:gap-4"`
- Right column (~209): `"flex shrink-0 flex-col items-end gap-2"` → `"flex w-full items-center justify-between gap-2 sm:w-auto sm:shrink-0 sm:flex-col sm:items-end"`
- Buy link inside it: add `flex-1 justify-center sm:flex-none`
- Totals footer (~234): `"mt-6 flex items-center justify-between border-t border-slate-200 pt-5"` → `"mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between"`; the "Clear Watchlist" button: add `self-start py-2 sm:self-auto`.

- [ ] **Step 3: Dashboard.**
- Signed-out back button (~116): `className="mb-6 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-600 transition"` → `className="btn btn-ghost -ml-3 mb-6 px-3 text-sm font-medium text-slate-500 hover:text-brand-600"`
- Signed-in back button (~236): `className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-600 transition"` → `className="btn btn-ghost -ml-3 px-3 text-sm font-medium text-slate-500 hover:text-brand-600"`

- [ ] **Step 4: Verify** — `npm run build && npm run lint`. Dev at 375px: open a listing detail — action buttons pinned at the sheet's bottom while content scrolls, no Close button; watchlist rows: Buy + trash form a full-width row under each item; totals stack; account screens have comfortably tappable back buttons. Desktop: detail footer static three-across as before.

- [ ] **Step 5: Commit**

```bash
git add src/components/PartDetailModal.tsx src/components/CartPanel.tsx src/components/Dashboard.tsx
git commit -m "Sticky sheet footer for part detail; mobile layouts for watchlist and dashboard"
```

---

### Task 10: Combobox touch sizing + remaining form attributes

**Files:**
- Modify: `src/components/Combobox.tsx` (props, input ~166-191, list ~200-243), `src/components/PartSelector.tsx` (part-search Combobox ~670, DTC input ~824, ZIP handled in Task 7)

**Interfaces:**
- Produces: `Combobox` gains optional `enterKeyHint?: 'search' | 'go' | 'done' | 'next'` prop, threaded to the input.

- [ ] **Step 1: Combobox prop + input.** Add `enterKeyHint` to the props type and destructure:

```tsx
  enterKeyHint,
}: {
  ...
  enterKeyHint?: 'search' | 'go' | 'done' | 'next'
}) {
```

On the `<input>` add: `enterKeyHint={enterKeyHint}`.

- [ ] **Step 2: Combobox touch sizing.**
- List `<ul>` (~204): `max-h-72` → `max-h-60 sm:max-h-72`
- Option `<li>` rows (~221): in the item (non-header) className template, change the shared prefix `rounded-lg px-3 py-2 text-sm` → `rounded-lg px-3 py-3 text-sm sm:py-2`
(The input font-size is already handled by `.field` from Task 1.)

- [ ] **Step 3: PartSelector inputs.**
- Part-search `Combobox` (~670): add `enterKeyHint="search"`.
- DTC input (~824): add `autoCapitalize="characters" autoCorrect="off" spellCheck={false} enterKeyHint="search"`.

- [ ] **Step 4: Verify** — `npm run build && npm run lint`. Dev at 375px: open Year/Make comboboxes — options are comfortably tappable, list doesn't collide with the keyboard area (shorter), focusing inputs does NOT zoom the page (16px). Desktop dropdown unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/components/Combobox.tsx src/components/PartSelector.tsx
git commit -m "Touch-size combobox options and add mobile keyboard hints"
```

---

### Task 11: Performance — font-weight trim + async image decoding

**Files:**
- Modify: `index.html:12-15` (Google Fonts URL), `src/components/PartDetailModal.tsx` (img ~52), `src/components/CartPanel.tsx` (imgs ~71, ~199), `src/components/PartSelector.tsx` (quote img ~601), `src/components/VehicleThumbnail.tsx` (its `<img>`)

**Interfaces:** none.

- [ ] **Step 1: Verify Barlow weights are unused before trimming.**

Run: `grep -rn "font-display\|section-title" src --include='*.tsx' --include='*.css' | grep -v "font-weight: 700" | head -30`
and: `grep -rn "Barlow" src`

`.font-display` and `.section-title` both hard-set `font-weight: 700` in `index.css`; nothing else references Barlow. If (and only if) that holds, change the fonts URL in `index.html` from `Barlow+Condensed:wght@500;600;700` to `Barlow+Condensed:wght@700`. Leave Inter and JetBrains Mono weights alone (`font-medium/semibold/bold/extrabold` and `font-data` combinations use them all).

- [ ] **Step 2: Add `decoding="async"`** to every listing/vehicle `<img>` listed in Files above (ListingCard already done in Task 8). Do not touch `loading`/`width`/`height` attributes that already exist.

- [ ] **Step 3: Verify** — `npm run build` and note the bundle sizes vs. the values printed in Task 3's build (vaul should be the only meaningful delta, ~5-8 kB gz on the main chunk). `npm run lint` passes. Headlines still render in Barlow Condensed bold (dev server spot check).

- [ ] **Step 4: Commit**

```bash
git add index.html src/components/PartDetailModal.tsx src/components/CartPanel.tsx src/components/PartSelector.tsx src/components/VehicleThumbnail.tsx
git commit -m "Trim unused Barlow weights and decode listing images asynchronously"
```

---

### Task 12: Full verification walkthrough + mobile report

**Files:**
- Create: `docs/superpowers/reports/2026-07-09-mobile-report.md`

**Interfaces:** none — this task produces the final deliverable report and fixes anything the walkthrough surfaces (small fixes belong in this task; anything structural gets its own follow-up task).

- [ ] **Step 1: Gates.** Run: `npm run build && npm run lint && npm test`
Expected: all pass (server tests unaffected but must stay green).

- [ ] **Step 2: Viewport walkthrough** with the dev server (`npm run dev:all`) using browser emulation at **375×667 (iPhone SE)**, **393×852 (iPhone 15 Pro)**, and **430×932 (Pro Max)** — plus one desktop pass at 1280px to confirm zero regressions. Note: per project memory, prefer DOM snapshots/inspection over full-page screenshots (eBay images stall network-idle screenshot waits). Walk every flow and check off:

- Home: hero fits, vehicle card top edge visible on SE; chips scroll
- Tab bar: Search/Watchlist/Account switching + active states + badge
- VIN decode (`1HGCM82633A004352` — 2003 Honda Accord) autofills; no page zoom while typing
- Garage: save vehicle, open Vehicle Health (renders as sheet), remove vehicle
- Sticky "Continue to parts" appears/works
- PartSelector: all 5 tabs reachable by horizontal scroll; symptom diagnosis + quote (buttons stacked); DTC P0302; photo tab renders upload UI; kits grid
- Results: skeletons → listings; mobile toolbar scrolls; FilterSheet round-trip (filters persist after close, badge counts, Clear all resets); sort works
- Listing card: Buy/Watch/Compare ≥44px; Details opens sheet; Best Value badge toggles explanation on tap
- Detail sheet: scrolls, footer pinned, swipe-down dismisses, Complete-the-job chips run new searches
- Compare: select 2+, bar sits above tab bar, comparison sheet's table scrolls horizontally
- Watchlist: add/remove/clear, stacked rows, compare table, Check prices
- Account: sign-in screen renders (Google button + form, no zoom on focus); if Supabase is unconfigured expect the honest 503 copy on submit
- Dark mode: every new surface (tab bar, sheets, filter sheet, sticky bar) readable in dark
- Back/forward browser buttons still restore views (URL routing untouched)

- [ ] **Step 3: Fix what the walkthrough finds.** Apply small fixes directly, re-run `npm run build && npm run lint`, and fold them into the walkthrough commit. If something needs structural change, write it up in the report's "Remaining issues" instead of hacking it.

- [ ] **Step 4: Write `docs/superpowers/reports/2026-07-09-mobile-report.md`** with these sections (content from the actual walkthrough, not aspirational): 1. Mobile UX audit summary; 2. Implemented improvements; 3. Components redesigned; 4. Performance improvements (with before/after bundle numbers from Tasks 3/11); 5. Accessibility improvements; 6. Remaining mobile issues; 7. Future recommendations; 8. Mobile readiness score 0-100 with one-line justification.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/reports/2026-07-09-mobile-report.md
git commit -m "Add mobile experience verification report"
```

---

## Self-Review (done at plan time)

- **Spec coverage:** Foundation/PWA → Tasks 1-2; navigation → Task 4; sheets → Task 3; StickyActionBar/CarSelector → Task 5; PartSelector → Task 6; ResultsList/FilterSheet/header → Task 7; ListingCard/tooltip → Task 8; PartDetailModal/CartPanel/Dashboard → Task 9; Combobox/forms → Task 10; perf → Tasks 1 (preconnect), 11; a11y woven through 3/4/7/8; testing/report → Task 12. VehicleHealthModal/RepairGuideModal/ComparisonModal need no direct edits (they inherit the sheet + touch floors). No gaps found.
- **Placeholder scan:** clean — every code step shows the code.
- **Type consistency:** `BottomTab`, `StickyActionBar({children})`, `FilterSheet` prop names, `useIsMobile()`, `enterKeyHint` union all match across tasks.
