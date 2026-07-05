import { useEffect, useState } from 'react'
import { Car as CarIcon, Bookmark, ShieldCheck, Zap, Tag, User as UserIcon, Moon, Sun, Trash2 } from 'lucide-react'
import { CarSelector, type Car } from './components/CarSelector'
import { PartSelector } from './components/PartSelector'
import { ResultsList } from './components/ResultsList'
import { CartPanel } from './components/CartPanel'
import { RecentSearches } from './components/RecentSearches'
import { StepIndicator } from './components/StepIndicator'
import { useCart } from './hooks/useCart'
import { useRecentSearches } from './hooks/useRecentSearches'
import { useHeadroom } from './hooks/useHeadroom'
import { routeFromSearch, searchFromRoute, type AppRoute, type Step } from './lib/searchUrl'
import { getSavedSearches, getPriceAlerts, signupUser, loginUser, deleteSavedSearch, deletePriceAlert } from './api/supabase'
import { Modal } from './components/Modal'

function App() {
  const initial = routeFromSearch(window.location.search)
  const [step, setStep] = useState<Step>(initial.step)
  const [car, setCar] = useState<Car | null>(initial.car)
  const [part, setPart] = useState<string | null>(initial.part)
  const [showWatchlist, setShowWatchlist] = useState(false)
  const [showAccount, setShowAccount] = useState(false)

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('cpf-dark-mode')
      return saved ? JSON.parse(saved) : false
    } catch {
      return false
    }
  })

  useEffect(() => {
    localStorage.setItem('cpf-dark-mode', JSON.stringify(darkMode))
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  const [user, setUser] = useState<{ name: string; email: string } | null>(() => {
    const saved = localStorage.getItem('carpartsradar-user')
    return saved ? JSON.parse(saved) : null
  })
  const [accountData, setAccountData] = useState<{ searches: any[]; alerts: any[] } | null>(null)
  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [accountTab, setAccountTab] = useState<'searches' | 'alerts'>('searches')

  const watchlist = useCart(user?.email)
  const recent = useRecentSearches()
  const { headroomRef } = useHeadroom()

  const applyRoute = (r: AppRoute) => {
    setStep(r.step)
    setCar(r.car)
    setPart(r.part)
    setShowWatchlist(false)
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

  const viewKey = showWatchlist ? 'watchlist' : step

  // Fetch real account data when opening the account modal
  useEffect(() => {
    if (showAccount && user) {
      Promise.all([
        getSavedSearches().catch(() => ({ searches: [] })),
        getPriceAlerts().catch(() => ({ alerts: [] }))
      ]).then(([searchesRes, alertsRes]) => {
        setAccountData({
          searches: searchesRes.searches || [],
          alerts: alertsRes.alerts || []
        })
      })
    }
  }, [showAccount, user])

  return (
    <div className="app-bg flex min-h-screen flex-col text-slate-900 dark:text-slate-100">
      <header ref={headroomRef} className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/95 dark:border-slate-800/70 dark:bg-slate-900/95 shadow-sm shadow-slate-900/[0.03] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <button type="button" onClick={goHome} className="group flex items-center gap-3.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 text-white shadow-lg shadow-brand-900/20 transition-all group-hover:scale-[1.02]">
              <CarIcon size={23} strokeWidth={2.5} />
            </span>
            <div className="text-left">
              <span className="block text-[21px] font-semibold tracking-[-0.4px] text-slate-950 dark:text-slate-50">CarPartsRadar</span>
              <span className="hidden text-xs font-medium tracking-[0.5px] text-slate-500 sm:block">LIVE PRICE COMPARISON</span>
            </div>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowWatchlist(true)}
              className="btn btn-secondary relative px-5 py-2.5 text-sm"
            >
              <Bookmark size={17} strokeWidth={2.3} />
              <span className="hidden sm:inline">Watchlist</span>
              {watchlist.items.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-500 px-1.5 text-[10px] font-bold text-white ring-2 ring-white">
                  {watchlist.items.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowAccount(true)}
              className="btn btn-secondary px-5 py-2.5 text-sm flex items-center gap-2"
            >
              <UserIcon size={17} strokeWidth={2.3} />
              <span>{user ? user.name.split(' ')[0] : 'Account'}</span>
            </button>
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className="btn btn-secondary p-2.5 flex items-center justify-center shrink-0"
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-10 pt-8 sm:px-6">
        {!showWatchlist && <StepIndicator current={step} />}
        <div key={viewKey} className="animate-slide-up">
          {showWatchlist ? (
            <CartPanel
              items={watchlist.items}
              onRemove={watchlist.removeItem}
              onClear={watchlist.clear}
              onClose={() => setShowWatchlist(false)}
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
                  <TrustBanner />
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
                  onAddToWatchlist={(listing) =>
                    watchlist.addItem(listing, `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ''}`, part)
                  }
                  isInWatchlist={watchlist.isInCart}
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

      {/* Account Modal */}
      {showAccount && (
        <Modal label="Account settings" onClose={() => setShowAccount(false)} maxWidth="max-w-md">
          <div className="p-6">
            <h3 className="text-xl font-semibold mb-4">Account</h3>
            
            {user ? (
              <div>
                <p className="mb-4">Logged in as <strong>{user.name}</strong> ({user.email})</p>

                {accountData && (
                  <div className="mb-6">
                    {/* Tab Switcher */}
                    <div className="flex border-b border-slate-100 mb-4">
                      <button
                        type="button"
                        onClick={() => setAccountTab('searches')}
                        className={`flex-1 pb-2.5 text-xs font-bold text-center border-b-2 transition ${
                          accountTab === 'searches'
                            ? 'border-brand-500 text-brand-500'
                            : 'border-transparent text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        Saved Searches ({accountData.searches.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAccountTab('alerts')}
                        className={`flex-1 pb-2.5 text-xs font-bold text-center border-b-2 transition ${
                          accountTab === 'alerts'
                            ? 'border-brand-500 text-brand-500'
                            : 'border-transparent text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        Price Alerts ({accountData.alerts.length})
                      </button>
                    </div>

                    {/* Tab Contents */}
                    <div className="max-h-60 overflow-y-auto pr-1">
                      {accountTab === 'searches' ? (
                        accountData.searches.length > 0 ? (
                          <div className="space-y-2">
                            {accountData.searches.map((s: any, i: number) => (
                              <div
                                key={i}
                                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 hover:bg-slate-50 transition"
                              >
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900 truncate text-xs">{s.part}</div>
                                  <div className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">
                                    {s.year} {s.make} {s.model} {s.trim ? `· ${s.trim}` : ''}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowAccount(false)
                                      runSearch({ year: s.year, make: s.make, model: s.model, trim: s.trim || '' }, s.part)
                                    }}
                                    className="btn btn-secondary px-2.5 py-1.5 text-[10px]"
                                  >
                                    Search
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`Delete saved search for ${s.part}`}
                                    onClick={async () => {
                                      try {
                                        await deleteSavedSearch(s.id)
                                        setAccountData((prev) =>
                                          prev
                                            ? {
                                                searches: prev.searches.filter((x) => x.id !== s.id),
                                                // Deleting a search cascades to its alerts server-side.
                                                alerts: prev.alerts.filter((a) => a.saved_search_id !== s.id),
                                              }
                                            : prev
                                        )
                                      } catch {
                                        /* leave the row; nothing was deleted */
                                      }
                                    }}
                                    className="btn btn-ghost p-1.5 text-slate-400 hover:text-rose-600"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-6 text-slate-400 text-xs">No saved searches yet.</div>
                        )
                      ) : (
                        accountData.alerts.length > 0 ? (
                          <div className="space-y-2">
                            {accountData.alerts.map((a: any, i: number) => (
                              <div
                                key={i}
                                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3"
                              >
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900 truncate text-xs">
                                    {a.saved_searches?.part || 'Part'}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">
                                    {a.saved_searches
                                      ? `${a.saved_searches.year} ${a.saved_searches.make} ${a.saved_searches.model}`
                                      : 'Vehicle'}
                                  </div>
                                  {a.triggered_at ? (
                                    <div className="mt-1 text-[10px] font-bold text-emerald-700">
                                      ✓ Dropped to ${Number(a.last_price).toFixed(2)}
                                    </div>
                                  ) : a.last_price != null ? (
                                    <div className="mt-1 text-[10px] font-medium text-slate-500">
                                      Last checked: ${Number(a.last_price).toFixed(2)}
                                    </div>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="badge bg-brand-50 text-brand-500 font-extrabold px-2.5 py-1">
                                    Target: ${a.target_price}
                                  </span>
                                  <button
                                    type="button"
                                    aria-label={`Delete price alert for ${a.saved_searches?.part || 'part'}`}
                                    onClick={async () => {
                                      try {
                                        await deletePriceAlert(a.id)
                                        setAccountData((prev) =>
                                          prev
                                            ? { ...prev, alerts: prev.alerts.filter((x) => x.id !== a.id) }
                                            : prev
                                        )
                                      } catch {
                                        /* leave the row; nothing was deleted */
                                      }
                                    }}
                                    className="btn btn-ghost p-1.5 text-slate-400 hover:text-rose-600"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-6 text-slate-400 text-xs">No price alerts active yet.</div>
                        )
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    localStorage.removeItem('carpartsradar-user')
                    setUser(null)
                    setShowAccount(false)
                    setAccountData(null)
                  }}
                  className="btn btn-secondary w-full"
                >
                  Log Out
                </button>
              </div>
            ) : (
              <div>
                {authError && (
                  <p className="mb-3 text-xs font-semibold text-rose-600 bg-rose-50 p-3 rounded-2xl border border-rose-100 animate-fade-in">
                    {authError}
                  </p>
                )}

                {isRegisterMode && (
                  <input
                    type="text"
                    placeholder="Full Name"
                    className="field mb-3"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                  />
                )}

                <input
                  type="email"
                  placeholder="Email"
                  className="field mb-3"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                />

                <input
                  type="password"
                  placeholder="Password"
                  className="field mb-4"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                />

                <button
                  disabled={authLoading}
                  onClick={async () => {
                    const email = signupEmail.trim()
                    const password = signupPassword
                    const name = signupName.trim()

                    if (!email || !password) {
                      setAuthError('Email and password are required.')
                      return
                    }

                    setAuthLoading(true)
                    setAuthError(null)

                    try {
                      let res
                      if (isRegisterMode) {
                        res = await signupUser({ email, password, name })
                      } else {
                        res = await loginUser({ email, password })
                      }

                      const newUser = {
                        name: res.user?.user_metadata?.full_name || email.split('@')[0] || 'User',
                        email: res.user?.email || email,
                        token: res.token
                      }

                      localStorage.setItem('carpartsradar-user', JSON.stringify(newUser))
                      setUser(newUser)

                      // Clear inputs and error
                      setSignupName('')
                      setSignupEmail('')
                      setSignupPassword('')
                      setAuthError(null)
                    } catch (err: any) {
                      setAuthError(err.message || 'Authentication failed.')
                    } finally {
                      setAuthLoading(false)
                    }
                  }}
                  className="btn btn-primary w-full"
                >
                  {authLoading ? 'Please wait…' : isRegisterMode ? 'Create Account' : 'Sign In'}
                </button>

                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegisterMode(!isRegisterMode)
                      setAuthError(null)
                    }}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700 underline"
                  >
                    {isRegisterMode ? 'Already have an account? Sign In' : "Don't have an account? Register"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

    </div>
  )
}

export default App

function TrustBanner() {
  return (
    <div className="mt-16 border-t border-slate-200/60 pt-12">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 text-center sm:text-left">
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="text-3xl font-extrabold tracking-tight text-slate-950">500,000+</div>
          <div className="mt-1 text-sm font-semibold text-slate-500 uppercase tracking-wider">Parts compared daily</div>
          <p className="mt-2 text-xs text-slate-500">Live inventory scans from top marketplaces and auto retailers.</p>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="text-3xl font-extrabold tracking-tight text-slate-950">NHTSA-Verified</div>
          <div className="mt-1 text-sm font-semibold text-slate-500 uppercase tracking-wider">Fitment accuracy</div>
          <p className="mt-2 text-xs text-slate-500">OEM specs cross-referenced with national vehicle manufacturer databases.</p>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="text-3xl font-extrabold tracking-tight text-slate-950">Real-Time</div>
          <div className="mt-1 text-sm font-semibold text-slate-500 uppercase tracking-wider">Price updates</div>
          <p className="mt-2 text-xs text-slate-500">Prices updated instantly. In-memory queries prevent slow loads.</p>
        </div>
      </div>

      {/* Customer Reviews Section */}
      <div className="mt-16 text-center">
        <h3 className="text-xs font-bold tracking-[1.5px] text-brand-600 uppercase">User Testimonials</h3>
        <h2 className="text-2xl font-bold tracking-tight text-slate-950 mt-2">Loved by DIYers & Professionals</h2>
        
        <div className="mt-8 grid gap-6 md:grid-cols-2 text-left">
          <blockquote className="rounded-3xl bg-slate-50 p-6 border border-slate-200/50">
            <p className="text-sm italic text-slate-700 leading-relaxed">
              "CarPartsRadar saved me over $120 on front brake rotors for my Lexus LX. It scanned eBay, mapped it to my exact trim, and let me buy direct from a highly rated seller."
            </p>
            <cite className="mt-4 block not-italic">
              <span className="block text-sm font-semibold text-slate-900">Arthur M.</span>
              <span className="block text-xs text-slate-400">DIY Mechanic & Car Owner</span>
            </cite>
          </blockquote>
          
          <blockquote className="rounded-3xl bg-slate-50 p-6 border border-slate-200/50">
            <p className="text-sm italic text-slate-700 leading-relaxed">
              "As a mobile mechanic, I use this tool on my tablet to compare prices for clients right in their driveways. The fitment checks have kept me from ordering wrong parts."
            </p>
            <cite className="mt-4 block not-italic">
              <span className="block text-sm font-semibold text-slate-900">Sarah K.</span>
              <span className="block text-xs text-slate-400">Mobile Auto Technician</span>
            </cite>
          </blockquote>
        </div>
      </div>
    </div>
  )
}
