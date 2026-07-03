import { useState } from 'react'
import { Car as CarIcon, ShoppingCart, ShieldCheck, Zap, Tag } from 'lucide-react'
import { CarSelector, type Car } from './components/CarSelector'
import { PartSelector } from './components/PartSelector'
import { ResultsList } from './components/ResultsList'
import { CartPanel } from './components/CartPanel'
import { RecentSearches } from './components/RecentSearches'
import { useCart } from './hooks/useCart'
import { useRecentSearches } from './hooks/useRecentSearches'

type Step = 'car' | 'part' | 'results'

function App() {
  const [step, setStep] = useState<Step>('car')
  const [car, setCar] = useState<Car | null>(null)
  const [part, setPart] = useState<string | null>(null)
  const [showCart, setShowCart] = useState(false)

  const cart = useCart()
  const recent = useRecentSearches()

  const runSearch = (selectedCar: Car, selectedPart: string) => {
    setCar(selectedCar)
    setPart(selectedPart)
    recent.record(selectedCar, selectedPart)
    setShowCart(false)
    setStep('results')
  }

  const goHome = () => {
    setShowCart(false)
    setCar(null)
    setPart(null)
    setStep('car')
  }

  const viewKey = showCart ? 'cart' : step

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white shadow-sm shadow-slate-900/5">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3.5">
          <button type="button" onClick={goHome} className="group flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm shadow-brand-600/30 transition group-hover:shadow-md">
              <CarIcon size={22} strokeWidth={2.2} />
            </span>
            <span className="text-left">
              <span className="block text-base font-extrabold leading-tight tracking-tight text-slate-900">
                Car Part Finder
              </span>
              <span className="hidden text-xs text-slate-500 sm:block">Live prices from trusted sellers</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowCart(true)}
            className="btn btn-secondary relative px-3.5 py-2"
          >
            <ShoppingCart size={16} strokeWidth={2.2} />
            <span className="hidden sm:inline">Cart</span>
            {cart.items.length > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-xs font-bold text-white ring-2 ring-white">
                {cart.items.length}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
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
                  <section className="mb-6 text-center">
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                      Find the right part at the{' '}
                      <span className="bg-gradient-to-r from-brand-600 to-brand-500 bg-clip-text text-transparent">
                        best price
                      </span>
                    </h1>
                    <p className="mx-auto mt-3 max-w-xl text-slate-500">
                      Search live listings that fit your exact vehicle — sorted by price, seller rating, and value.
                    </p>
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <ShieldCheck size={16} className="text-brand-600" /> Verified fitment
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Zap size={16} className="text-brand-600" /> Live prices
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Tag size={16} className="text-brand-600" /> Best-value ranking
                      </span>
                    </div>
                  </section>

                  <CarSelector
                    onConfirm={(selectedCar) => {
                      setCar(selectedCar)
                      setStep('part')
                    }}
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
                  onBack={() => setStep('car')}
                  onSelect={(selectedPart) => runSearch(car, selectedPart)}
                />
              )}

              {step === 'results' && car && part && (
                <ResultsList
                  car={car}
                  part={part}
                  onBackToPart={() => setStep('part')}
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

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-6 text-center text-xs text-slate-400">
          Car Part Finder aggregates live listings from third-party marketplaces. Prices and availability are set by
          sellers and may change.
        </div>
      </footer>
    </div>
  )
}

export default App
