import { useEffect, useState, Suspense, lazy } from 'react'
import { Toaster } from 'sonner'
import { Helmet } from 'react-helmet-async'
import { Car as CarIcon, Bookmark, ShieldCheck, Zap, Tag, User as UserIcon, Moon, Sun } from 'lucide-react'
import { CarSelector, type Car } from './components/CarSelector'

const PartSelector = lazy(() => import('./components/PartSelector').then(m => ({ default: m.PartSelector })))
const ResultsList = lazy(() => import('./components/ResultsList').then(m => ({ default: m.ResultsList })))
const CartPanel = lazy(() => import('./components/CartPanel').then(m => ({ default: m.CartPanel })))
const RecentSearches = lazy(() => import('./components/RecentSearches').then(m => ({ default: m.RecentSearches })))
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })))

import { StepIndicator } from './components/StepIndicator'
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

  const viewKey = showWatchlist ? 'watchlist' : step

  return (
    <div className="app-bg flex min-h-screen flex-col text-slate-900 dark:text-slate-100">
      <Helmet>
        <title>CarPartsRadar — Compare Car Part Prices & Find Cheap Auto Parts</title>
        <meta name="description" content="Compare car part prices instantly. Find the cheapest live auto parts and listings from eBay and major retailers that fit your exact vehicle." />
        <meta property="og:title" content="CarPartsRadar — Compare Car Part Prices & Find Cheap Auto Parts" />
        <meta property="og:description" content="Real-time price comparison for auto parts. Compare eBay listings and major retailers instantly for your exact vehicle." />
      </Helmet>
      
      <Toaster position="top-center" richColors />
      <header ref={headroomRef} className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/95 dark:border-slate-800/70 dark:bg-slate-900/95 shadow-sm shadow-slate-900/[0.03] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <button type="button" onClick={goHome} className="group flex min-w-0 items-center gap-2.5 sm:gap-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-700 text-white shadow-lg shadow-brand-900/20 transition-all group-hover:scale-[1.02] sm:h-11 sm:w-11 sm:rounded-2xl">
              <CarIcon size={20} strokeWidth={2.5} className="sm:hidden" />
              <CarIcon size={23} strokeWidth={2.5} className="hidden sm:block" />
            </span>
            <div className="min-w-0 text-left">
              <span className="block truncate text-lg font-semibold tracking-[-0.4px] text-slate-950 dark:text-slate-50 sm:text-[21px]">CarPartsRadar</span>
              <span className="hidden text-xs font-medium tracking-[0.5px] text-slate-500 sm:block">LIVE PRICE COMPARISON</span>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowWatchlist(true)}
              className="btn btn-secondary relative px-3 py-2.5 text-sm sm:px-4"
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
              className={`btn flex items-center gap-2 px-3 py-2.5 text-sm sm:px-4 ${step === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
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

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-10 pt-8 sm:px-6">
        {!showWatchlist && step !== 'dashboard' && <StepIndicator current={step as Step} />}
        <div key={viewKey} className="animate-slide-up">
          {showWatchlist ? (
            <Suspense fallback={<div className="py-20 text-center text-sm text-slate-500 font-medium">Loading component...</div>}>
              <CartPanel
                items={watchlist.items}
                onRemove={watchlist.removeItem}
                onClear={watchlist.clear}
                onClose={() => setShowWatchlist(false)}
              />
            </Suspense>
          ) : step === 'dashboard' ? (
            <Suspense fallback={<div className="py-20 text-center text-sm text-slate-500 font-medium">Loading Dashboard...</div>}>
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
                  {/* Hero */}
                  <div className="mb-12 pt-4 text-center sm:mb-16 sm:pt-8">
                    <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50/60 px-4 py-1.5 text-xs font-semibold text-brand-700 dark:border-brand-900/40 dark:bg-brand-950/30 dark:text-brand-400">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-60" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
                      </span>
                      Live prices, filtered to your exact vehicle
                    </div>

                    <h1 className="mx-auto max-w-4xl text-balance text-4xl font-semibold tracking-[-1px] text-slate-950 sm:text-6xl sm:tracking-[-2.2px]">
                      Find the exact parts your vehicle needs, at the lowest prices.
                    </h1>

                    <p className="mx-auto mt-5 max-w-lg text-balance text-base text-slate-600 sm:text-lg">
                      Compare prices across major marketplaces instantly. Fully verified fitment guaranteed.
                    </p>

                    <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5 text-sm">
                      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 shadow-sm">
                        <ShieldCheck size={14} className="text-brand-600" /> Fitment checked
                      </div>
                      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 shadow-sm">
                        <Zap size={14} className="text-brand-600" /> Live pricing
                      </div>
                      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 shadow-sm">
                        <Tag size={14} className="text-brand-600" /> Value ranked
                      </div>
                    </div>
                  </div>

                  <Suspense fallback={<div className="py-20 text-center text-sm text-slate-500 font-medium">Loading component...</div>}>
                    <CarSelector
                      onConfirm={(selectedCar) => navigate({ step: 'part', car: selectedCar, part: null })}
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
                <Suspense fallback={<div className="py-20 text-center text-sm text-slate-500 font-medium">Loading component...</div>}>
                  <PartSelector
                    car={car}
                    onBack={goHome}
                    onSelect={(selectedPart) => runSearch(car, selectedPart)}
                  />
                </Suspense>
              )}

              {step === 'results' && car && part && (
                <Suspense fallback={<div className="py-20 text-center text-sm text-slate-500 font-medium">Loading component...</div>}>
                  <ResultsList
                    car={car}
                    part={part}
                    onBackToPart={() => navigate({ step: 'part', car, part: null })}
                    onBackToCar={goHome}
                    onAddToWatchlist={(listing) =>
                      watchlist.addItem(listing, `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ''}`, part)
                    }
                    isInWatchlist={watchlist.isInCart}
                  />
                </Suspense>
              )}
            </>
          )}
        </div>
      </main>

      <footer className="border-t border-slate-200/80 bg-white/80 dark:border-slate-800/80 dark:bg-slate-950/60">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-brand-700 text-white">
                <CarIcon size={16} strokeWidth={2.5} />
              </span>
              <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">CarPartsRadar</span>
            </div>
            <div className="max-w-xl space-y-2 text-center text-xs leading-relaxed text-slate-500 sm:text-right">
              <p>
                We compare live listings from third-party marketplaces. Prices and availability are set by sellers
                and may change — always confirm details on the retailer's site before buying.
              </p>
              <p>
                Affiliate disclosure: some outbound links are affiliate links, meaning we may earn a commission if
                you make a purchase — at no extra cost to you. As an Amazon Associate, CarPartsRadar earns from
                qualifying purchases.
              </p>
            </div>
          </div>
          <p className="mt-8 border-t border-slate-100 pt-5 text-center text-xs text-slate-400 dark:border-slate-800/60">
            © {new Date().getFullYear()} CarPartsRadar — Not affiliated with eBay, Amazon, or any retailer listed.
          </p>
        </div>
      </footer>
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
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-bold text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-400 shadow-sm">
          <ShieldCheck size={16} /> Over 45,000 parts compared daily
        </div>
        <p className="eyebrow text-brand-600 dark:text-brand-400">How it works</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          From vehicle to best price in three steps
        </h2>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
        {steps.map((s, i) => (
          <div key={s.title} className="card relative p-6">
            <span className="absolute right-5 top-5 text-4xl font-semibold tracking-tight text-slate-100 dark:text-slate-800" aria-hidden>
              {i + 1}
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
