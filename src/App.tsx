import { useEffect, useState } from 'react'
import { Car as CarIcon, ShoppingCart, ShieldCheck, Zap, Tag } from 'lucide-react'
import { CarSelector, type Car } from './components/CarSelector'
import { PartSelector } from './components/PartSelector'
import { ResultsList } from './components/ResultsList'
import { CartPanel } from './components/CartPanel'
import { RecentSearches } from './components/RecentSearches'
import { StepIndicator } from './components/StepIndicator'
import { useCart } from './hooks/useCart'
import { useRecentSearches } from './hooks/useRecentSearches'
import { routeFromSearch, searchFromRoute, type AppRoute, type Step } from './lib/searchUrl'

function App() {
  const initial = routeFromSearch(window.location.search)
  const [step, setStep] = useState<Step>(initial.step)
  const [car, setCar] = useState<Car | null>(initial.car)
  const [part, setPart] = useState<string | null>(initial.part)
  const [showCart, setShowCart] = useState(false)

  const cart = useCart()
  const recent = useRecentSearches()

  const applyRoute = (r: AppRoute) => {
    setStep(r.step)
    setCar(r.car)
    setPart(r.part)
    setShowCart(false)
  }

  // Push a new history entry and update the view. The URL is what makes a
  // search shareable, bookmarkable, and refresh-safe.
  const navigate = (r: AppRoute) => {
    window.history.pushState(null, '', window.location.pathname + searchFromRoute(r))
    applyRoute(r)
  }

  // Browser back/forward: re-derive the view from the URL. Never push here or
  // we'd corrupt the history stack.
  useEffect(() => {
    const onPop = () => applyRoute(routeFromSearch(window.location.search))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const runSearch = (selectedCar: Car, selectedPart: string) => {
    recent.record(selectedCar, selectedPart)
    navigate({ step: 'results', car: selectedCar, part: selectedPart })
  }

  const goHome = () => navigate({ step: 'car', car: null, part: null })

  const viewKey = showCart ? 'cart' : step

  return (
    <div className="app-bg flex min-h-screen flex-col text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/95 shadow-sm shadow-slate-900/[0.03] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <button type="button" onClick={goHome} className="group flex items-center gap-3.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 text-white shadow-lg shadow-brand-900/20 transition-all group-hover:scale-[1.02]">
              <CarIcon size={23} strokeWidth={2.5} />
            </span>
            <div className="text-left">
              <span className="block text-[21px] font-semibold tracking-[-0.4px] text-slate-950">CarPartsRadar</span>
              <span className="hidden text-xs font-medium tracking-[0.5px] text-slate-500 sm:block">LIVE PRICE COMPARISON</span>
            </div>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowCart(true)}
              className="btn btn-secondary relative px-5 py-2.5 text-sm"
            >
              <ShoppingCart size={17} strokeWidth={2.3} />
              <span className="hidden sm:inline">Cart</span>
              {cart.items.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-500 px-1.5 text-[10px] font-bold text-white ring-2 ring-white">
                  {cart.items.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-10 pt-8 sm:px-6">
        {!showCart && <StepIndicator current={step} />}
        <div key={viewKey} className="animate-slide-up">
          {showCart ? (
            <CartPanel
              items={cart.items}
              onRemove={cart.removeItem}
              onClear={cart.clear}
              onClose={() => setShowCart(false)}
            />
          ) : (
            <>
              {step === 'car' && (
                <>
                  {/* Premium Hero */}
                  <div className="mb-12 text-center">
                    <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-1.5 text-xs font-semibold tracking-[1px] text-brand-700 shadow-sm ring-1 ring-brand-100">
                      LIVE PRICES • FITMENT-FILTERED • VALUE-RANKED
                    </div>

                    <h1 className="text-balance text-4xl font-semibold tracking-[-1px] text-slate-950 sm:text-6xl sm:tracking-[-2.2px] lg:text-7xl">
                      The smartest way to buy car parts.
                    </h1>

                    <p className="mx-auto mt-5 max-w-lg text-lg text-slate-600">
                      Real-time prices from eBay and major retailers, filtered to fit your exact vehicle.
                    </p>

                    <div className="mt-7 flex flex-wrap items-center justify-center gap-3 text-sm">
                      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-slate-600 shadow-sm">
                        <ShieldCheck size={15} className="text-brand-600" /> Verified fitment
                      </div>
                      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-slate-600 shadow-sm">
                        <Zap size={15} className="text-brand-600" /> Live pricing
                      </div>
                      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-slate-600 shadow-sm">
                        <Tag size={15} className="text-brand-600" /> Best value ranked
                      </div>
                    </div>
                  </div>

                  <CarSelector
                    onConfirm={(selectedCar) => navigate({ step: 'part', car: selectedCar, part: null })}
                  />
                  <RecentSearches
                    searches={recent.searches}
                    onPick={(s) => runSearch(s.car, s.part)}
                    onClear={recent.clear}
                  />
                </>
              )}

              {step === 'part' && car && (
                <PartSelector
                  car={car}
                  onBack={goHome}
                  onSelect={(selectedPart) => runSearch(car, selectedPart)}
                />
              )}

              {step === 'results' && car && part && (
                <ResultsList
                  car={car}
                  part={part}
                  onBackToPart={() => navigate({ step: 'part', car, part: null })}
                  onBackToCar={goHome}
                  onAddToCart={(listing) =>
                    cart.addItem(listing, `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ''}`, part)
                  }
                  isInCart={cart.isInCart}
                />
              )}
            </>
          )}
        </div>
      </main>

      <footer className="border-t border-slate-200/80 bg-white/80">
        <div className="mx-auto max-w-6xl px-6 py-8 text-center">
          <div className="text-sm font-medium text-slate-600">CarPartsRadar</div>
          <p className="mx-auto mt-2 max-w-lg text-xs text-slate-500">
            We compare live listings from third-party marketplaces. Prices and availability are set by sellers and
            may change — always confirm details on the retailer's site before buying.
          </p>
          <p className="mx-auto mt-2 max-w-lg text-xs text-slate-500">
            Affiliate disclosure: some outbound links are affiliate links, meaning we may earn a commission if you
            make a purchase — at no extra cost to you. As an Amazon Associate, CarPartsRadar earns from qualifying
            purchases.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            © {new Date().getFullYear()} CarPartsRadar — Not affiliated with eBay, Amazon, or any retailer listed.
          </p>
        </div>
      </footer>

    </div>
  )
}

export default App
