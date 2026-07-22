import { useEffect, useState, Suspense, lazy } from 'react'
import { Toaster } from 'sonner'
import { Helmet } from 'react-helmet-async'
import { Car as CarIcon, Bookmark, BookOpen, ShieldCheck, Zap, Tag, User as UserIcon, Moon, Sun } from 'lucide-react'
import { RadarMark } from './components/RadarMark'
import { BottomNav } from './components/BottomNav'
import { CarSelector, type Car } from './components/CarSelector'

const PartSelector = lazy(() => import('./components/PartSelector').then(m => ({ default: m.PartSelector })))
const ResultsList = lazy(() => import('./components/ResultsList').then(m => ({ default: m.ResultsList })))
const CartPanel = lazy(() => import('./components/CartPanel').then(m => ({ default: m.CartPanel })))
const RecentSearches = lazy(() => import('./components/RecentSearches').then(m => ({ default: m.RecentSearches })))
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })))

import { StepIndicator } from './components/StepIndicator'

// Shared Suspense fallback for lazily-loaded views: a quiet spinner instead of
// developer-facing "Loading component..." text. aria-label keeps it announced
// to screen readers without visible jargon.
function ViewLoader() {
  return (
    <div className="flex justify-center py-24" role="status" aria-label="Loading">
      <RadarMark className="h-8 w-8 text-brand-600 dark:text-brand-400" />
    </div>
  )
}
import { useCart } from './hooks/useCart'
import { useRecentSearches } from './hooks/useRecentSearches'
import { useHeadroom } from './hooks/useHeadroom'
import { routeFromSearch, searchFromRoute, type AppRoute, type Step } from './lib/searchUrl'
import { useAppContext } from './contexts/AppContext'
import { trackSearch } from './lib/analytics'

function App() {
  const { user, darkMode, setDarkMode } = useAppContext()
  const initial = routeFromSearch(window.location.search)
  const [step, setStep] = useState<Step | 'dashboard'>(initial.step)
  const [car, setCar] = useState<Car | null>(initial.car)
  const [part, setPart] = useState<string | null>(initial.part)
  const [showWatchlist, setShowWatchlist] = useState(false)

  const watchlist = useCart(user?.email)
  const recent = useRecentSearches()
  const { headroomRef } = useHeadroom()

  const applyRoute = (r: AppRoute) => {
    setStep(r.step)
    setCar(r.car)
    setPart(r.part)
    setShowWatchlist(false)
  }
  // search shareable, bookmarkable, and refresh-safe.
  const navigate = (r: AppRoute) => {
    const newSearch = searchFromRoute(r)
    if (window.location.search !== newSearch) {
      window.history.pushState(null, '', window.location.pathname + newSearch)
    }
    applyRoute(r)
  }

  // Browser back/forward: re-derive the view from the URL. Never push here or
  // we'd corrupt the history stack.
  useEffect(() => {
    const onPop = () => applyRoute(routeFromSearch(window.location.search))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const runSearch = (selectedCar: { year: string, make: string, model: string, trim?: string }, selectedPart: string) => {
    const fullCar: Car = { ...selectedCar, trim: selectedCar.trim || '' }
    recent.record(fullCar, selectedPart)
    trackSearch(fullCar.year, fullCar.make, fullCar.model, selectedPart)
    navigate({ step: 'results', car: fullCar, part: selectedPart })
  }

  const goHome = () => {
    setStep('car')
    navigate({ step: 'car', car: null, part: null })
  }

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

  const viewKey = showWatchlist ? 'watchlist' : step

  return (
    <div className="app-bg flex min-h-screen flex-col text-slate-900 dark:text-slate-100">
      <Helmet>
        <title>CarPartsRadar | Compare Car Part Prices and Fitment</title>
        <meta name="description" content="Compare car part prices instantly. Find the cheapest live auto parts and listings from eBay and major retailers that fit your exact vehicle." />
        <meta property="og:title" content="CarPartsRadar | Compare Car Part Prices and Fitment" />
        <meta property="og:description" content="Real-time price comparison for auto parts. Compare eBay listings and major retailers instantly for your exact vehicle." />
      </Helmet>
      
      <Toaster position="top-center" richColors />
      <header ref={headroomRef} className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/95 dark:border-slate-800/70 dark:bg-slate-900/95 shadow-sm shadow-slate-900/[0.03] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <button type="button" onClick={goHome} className="group flex min-w-0 items-center gap-2.5 sm:gap-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-lg shadow-brand-900/25 transition-all group-hover:scale-[1.03] sm:h-11 sm:w-11 sm:rounded-2xl">
              <RadarMark className="h-6 w-6 sm:h-7 sm:w-7" />
            </span>
            <div className="min-w-0 text-left">
              <span className="font-display block truncate text-[22px] leading-none text-slate-950 dark:text-slate-50 sm:text-[26px]">
                CarParts<span className="text-brand-600 dark:text-brand-400">Radar</span>
              </span>
              <span className="font-data hidden text-[10px] font-medium tracking-[1.5px] text-slate-500 sm:block">LIVE PRICE COMPARISON</span>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <a
              href="/guides.html"
              className="btn btn-secondary hidden px-3 py-2.5 text-sm sm:inline-flex sm:px-4"
              aria-label="Open buying guides"
            >
              <BookOpen size={17} strokeWidth={2.3} />
              <span className="hidden lg:inline">Guides</span>
            </a>
            <button
              type="button"
              onClick={() => setShowWatchlist(true)}
              className="btn btn-secondary relative hidden px-3 py-2.5 text-sm sm:inline-flex sm:px-4"
              aria-label="Open watchlist"
            >
              <Bookmark size={17} strokeWidth={2.3} />
              <span className="hidden sm:inline">Watchlist</span>
              {watchlist.items.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-500 px-1.5 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
                  {watchlist.items.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('dashboard')
                setShowWatchlist(false)
              }}
              className={`btn hidden items-center gap-2 px-3 py-2.5 text-sm sm:inline-flex sm:px-4 ${step === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
              aria-label="Open account"
            >
              <UserIcon size={17} strokeWidth={2.3} />
              <span className="hidden sm:inline">{user ? user.name.split(' ')[0] : 'Account'}</span>
            </button>
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className="btn btn-secondary flex shrink-0 items-center justify-center p-2.5"
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-8 sm:px-6 sm:pb-10">
        {!showWatchlist && step !== 'dashboard' && <StepIndicator current={step as Step} />}
        {/* Entrance animation must be removed once done: a transform animation
            (even filled at identity) makes this div the containing block for
            position:fixed descendants like the compare bar, pinning them to
            the document instead of the viewport. */}
        <div
          key={viewKey}
          className="animate-slide-up"
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget) e.currentTarget.classList.remove('animate-slide-up')
          }}
        >
          {showWatchlist ? (
            <Suspense fallback={<ViewLoader />}>
              <CartPanel
                items={watchlist.items}
                onRemove={watchlist.removeItem}
                onClear={watchlist.clear}
                onClose={() => setShowWatchlist(false)}
              />
            </Suspense>
          ) : step === 'dashboard' ? (
            <Suspense fallback={<ViewLoader />}>
              <Dashboard 
                onClose={() => {
                  if (car && part) setStep('results')
                  else if (car) setStep('part')
                  else setStep('car')
                }} 
                onRunSearch={runSearch} 
              />
            </Suspense>
          ) : (
            <>
              {step === 'car' && (
                <>
                  {/* Hero — the thesis. A radar live badge, a racing-decal
                      headline, and the honest fitment promise underneath.
                      Elements stagger in once on load; the sweep keeps the
                      "live scan" idea moving after the entrance settles. */}
                  <div className="blueprint-grid relative mb-10 pt-4 text-center sm:mb-16 sm:pt-10">
                    <div className="animate-slide-up font-data mx-auto mb-5 inline-flex items-center gap-2.5 rounded-full border border-brand-200/70 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700 shadow-sm dark:border-brand-900/40 dark:bg-slate-900 dark:text-brand-400 sm:mb-7">
                      <RadarMark className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                      Live scan — prices pulled per search
                    </div>

                    <h1 className="font-display animate-slide-up mx-auto max-w-4xl text-balance text-4xl text-slate-950 sm:text-7xl md:text-8xl [animation-delay:90ms]">
                      Parts that fit.
                      <br />
                      <span className="text-brand-600 dark:text-brand-400">Prices on radar.</span>
                    </h1>

                    <p className="animate-slide-up mx-auto mt-4 max-w-lg text-balance text-base text-slate-600 sm:mt-6 sm:text-lg [animation-delay:180ms]">
                      Pick your year, make, and model. Every listing is checked against real
                      compatibility data for your exact vehicle — and clearly labeled on the rare one we can't verify.
                    </p>

                    <div className="animate-slide-up -mx-5 mt-6 flex items-center gap-2.5 overflow-x-auto scrollbar-none px-5 sm:mx-0 sm:mt-8 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0 [animation-delay:260ms]">
                      <div className="font-data flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-600 shadow-sm">
                        <ShieldCheck size={13} className="text-brand-600" /> Fitment matched, not guessed
                      </div>
                      <div className="font-data flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-600 shadow-sm">
                        <Zap size={13} className="text-brand-600" /> Prices pulled live
                      </div>
                      <div className="font-data flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-600 shadow-sm">
                        <Tag size={13} className="text-brand-600" /> Ranked by real value
                      </div>
                    </div>
                  </div>

                  <Suspense fallback={<ViewLoader />}>
                    <CarSelector
                      onConfirm={(selectedCar) => navigate({ step: 'part', car: selectedCar, part: null })}
                      onSearchPart={(garageCar, garagePart) => runSearch(garageCar, garagePart)}
                    />
                    <RecentSearches
                      searches={recent.searches}
                      onPick={(s) => runSearch(s.car, s.part)}
                      onClear={recent.clear}
                    />
                    <TrustBanner />
                  </Suspense>
                </>
              )}

              {step === 'part' && car && (
                <Suspense fallback={<ViewLoader />}>
                  <PartSelector
                    car={car}
                    onBack={goHome}
                    onSelect={(selectedPart) => runSearch(car, selectedPart)}
                  />
                </Suspense>
              )}

              {step === 'results' && car && part && (
                <Suspense fallback={<ViewLoader />}>
                  <ResultsList
                    car={car}
                    part={part}
                    onBackToPart={() => navigate({ step: 'part', car, part: null })}
                    onBackToCar={goHome}
                    onAddToWatchlist={(listing) =>
                      watchlist.addItem(listing, `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ''}`, part)
                    }
                    isInWatchlist={watchlist.isInCart}
                    onSearchPart={(p) => runSearch(car, p)}
                  />
                </Suspense>
              )}
            </>
          )}
        </div>
      </main>

      <footer className="border-t border-slate-200/80 bg-white/80 dark:border-slate-800/80 dark:bg-slate-950/60">
        <div className="mx-auto max-w-6xl px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-10 sm:pb-10">
          <div className="grid gap-8 sm:grid-cols-[minmax(0,1.4fr)_auto_auto] sm:gap-10">
            <div>
              <div className="flex items-center justify-center gap-2.5 sm:justify-start">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-brand-800 text-white">
                  <RadarMark className="h-5 w-5" />
                </span>
                <span className="font-display text-lg leading-none text-slate-900 dark:text-slate-100">
                  CarParts<span className="text-brand-600 dark:text-brand-400">Radar</span>
                </span>
              </div>
              <div className="mt-4 max-w-xl space-y-2 text-center text-xs leading-relaxed text-slate-500 sm:text-left">
                <p>
                  We compare live listings from third-party marketplaces. Prices and availability are set by sellers
                  and may change. Always confirm details on the retailer's site before buying.
                </p>
                <p>
                  Some outbound links are affiliate links, meaning we may earn a commission if you make a purchase
                  at no extra cost to you.
                </p>
              </div>
            </div>
            <nav aria-label="Explore" className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm sm:flex-col sm:items-start sm:gap-2">
              <span className="w-full text-center font-semibold text-slate-900 dark:text-slate-100 sm:text-left">Explore</span>
              <a className="text-slate-500 transition-colors hover:text-brand-600 dark:hover:text-brand-400" href="/guides.html">Buying guides</a>
              <a className="text-slate-500 transition-colors hover:text-brand-600 dark:hover:text-brand-400" href="/methodology.html">Methodology</a>
              <a className="text-slate-500 transition-colors hover:text-brand-600 dark:hover:text-brand-400" href="/about.html">About</a>
              <a className="text-slate-500 transition-colors hover:text-brand-600 dark:hover:text-brand-400" href="/contact.html">Contact</a>
            </nav>
            <nav aria-label="Policies" className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm sm:flex-col sm:items-start sm:gap-2">
              <span className="w-full text-center font-semibold text-slate-900 dark:text-slate-100 sm:text-left">Policies</span>
              <a className="text-slate-500 transition-colors hover:text-brand-600 dark:hover:text-brand-400" href="/privacy.html">Privacy</a>
              <a className="text-slate-500 transition-colors hover:text-brand-600 dark:hover:text-brand-400" href="/terms.html">Terms</a>
              <a className="text-slate-500 transition-colors hover:text-brand-600 dark:hover:text-brand-400" href="/affiliate-disclosure.html">Affiliate disclosure</a>
            </nav>
          </div>
          <p className="mt-8 border-t border-slate-100 pt-5 text-center text-xs text-slate-400 dark:border-slate-800/60">
            © {new Date().getFullYear()} CarPartsRadar. We are not a retailer and do not sell listed products.
          </p>
        </div>
      </footer>

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
    </div>
  )
}

export default App

// Honest value props only — no invented stats or testimonials. Everything
// stated here is something the product actually does.
function TrustBanner() {
  const steps = [
    {
      icon: CarIcon,
      title: 'Tell us your vehicle',
      body: 'Year, make, and model come straight from the national NHTSA vehicle database — every trim, back to 1980.',
    },
    {
      icon: ShieldCheck,
      title: 'We filter for fitment',
      body: "Listings are matched against eBay's compatibility data for your exact vehicle, and we label anything we can't verify.",
    },
    {
      icon: Tag,
      title: 'Compare and buy direct',
      body: 'Live prices with shipping and delivery estimates, ranked by value. You buy from the seller — we never mark up.',
    },
  ]

  return (
    <div className="mt-20 border-t border-slate-200/60 pt-14 dark:border-slate-800/60">
      <div className="text-center">
        <p className="eyebrow text-brand-600 dark:text-brand-400">How it works</p>
        <h2 className="font-display mt-3 text-3xl text-slate-950 sm:text-4xl">
          From vehicle to best price in three steps
        </h2>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
        {steps.map((s, i) => (
          <div key={s.title} className="card group relative p-6 transition-transform duration-300 hover:-translate-y-1">
            {/* Mono step index — this really is a sequence, so the numbering
                carries information, not decoration. */}
            <span className="font-data absolute right-5 top-5 text-sm font-semibold text-slate-300 transition-colors group-hover:text-brand-500 dark:text-slate-700" aria-hidden>
              0{i + 1}
            </span>
            <div className="icon-tile bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400">
              <s.icon size={18} strokeWidth={2} />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">{s.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
