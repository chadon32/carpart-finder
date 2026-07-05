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
  const [authNotice, setAuthNotice] = useState<string | null>(null)
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
              onClick={() => setShowAccount(true)}
              className="btn btn-secondary flex items-center gap-2 px-3 py-2.5 text-sm sm:px-4"
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
                  {/* Hero */}
                  <div className="mb-12 pt-4 text-center sm:mb-16 sm:pt-8">
                    <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50/60 px-4 py-1.5 text-xs font-semibold text-brand-700 dark:border-brand-900/40 dark:bg-brand-950/30 dark:text-brand-400">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-60" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
                      </span>
                      Live prices, filtered to your exact vehicle
                    </div>

                    <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold tracking-[-1px] text-slate-950 sm:text-6xl sm:tracking-[-2.2px]">
                      The smartest way to buy car parts.
                    </h1>

                    <p className="mx-auto mt-5 max-w-lg text-balance text-base text-slate-600 sm:text-lg">
                      Compare real-time listings from eBay and major retailers — matched to your year, make, model, and trim.
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

      {/* Account Modal */}
      {showAccount && (
        <Modal label="Account settings" onClose={() => setShowAccount(false)} maxWidth="max-w-md">
          <div className="p-6 sm:p-7">
            {user ? (
              <div>
                <div className="mb-6 flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700 dark:bg-brand-950/40 dark:text-brand-400">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                  </div>
                </div>

                {accountData && (
                  <div className="mb-6">
                    {/* Tab Switcher */}
                    <div className="flex border-b border-slate-100 mb-4">
                      <button
                        type="button"
                        onClick={() => setAccountTab('searches')}
                        className={`tab ${accountTab === 'searches' ? 'tab-active' : ''}`}
                      >
                        Saved Searches ({accountData.searches.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAccountTab('alerts')}
                        className={`tab ${accountTab === 'alerts' ? 'tab-active' : ''}`}
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
              <form
                onSubmit={(e) => e.preventDefault()}
              >
                <div className="mb-6 text-center">
                  <h3 className="text-lg font-semibold tracking-tight text-slate-950">
                    {isRegisterMode ? 'Create your account' : 'Welcome back'}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {isRegisterMode
                      ? 'Save searches and get price-drop alerts.'
                      : 'Sign in to your saved searches and alerts.'}
                  </p>
                </div>

                {authError && (
                  <p className="mb-4 animate-fade-in rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs font-medium text-rose-700">
                    {authError}
                  </p>
                )}

                {authNotice && (
                  <p className="mb-4 animate-fade-in rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs font-medium text-emerald-700">
                    {authNotice}
                  </p>
                )}

                {isRegisterMode && (
                  <div className="mb-3">
                    <label htmlFor="auth-name" className="field-label">Full name</label>
                    <input
                      id="auth-name"
                      type="text"
                      autoComplete="name"
                      placeholder="Jane Doe"
                      className="field"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                    />
                  </div>
                )}

                <div className="mb-3">
                  <label htmlFor="auth-email" className="field-label">Email</label>
                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="field"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                  />
                </div>

                <div className="mb-5">
                  <label htmlFor="auth-password" className="field-label">Password</label>
                  <input
                    id="auth-password"
                    type="password"
                    autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                    placeholder="••••••••"
                    className="field"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
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
                    setAuthNotice(null)

                    try {
                      let res
                      if (isRegisterMode) {
                        res = await signupUser({ email, password, name })
                      } else {
                        res = await loginUser({ email, password })
                      }

                      // No session token means the Supabase project requires
                      // email confirmation. Persisting a tokenless user would
                      // look logged-in but 401 on every authed action, so
                      // instead prompt them to confirm, then sign in.
                      if (!res.token) {
                        setIsRegisterMode(false)
                        setSignupPassword('')
                        setAuthNotice(
                          isRegisterMode
                            ? 'Account created! Check your email to confirm your address, then sign in.'
                            : 'Please confirm your email address, then sign in.'
                        )
                        return
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
                      setAuthNotice(null)
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

                <div className="mt-5 border-t border-slate-100 pt-4 text-center dark:border-slate-800/60">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegisterMode(!isRegisterMode)
                      setAuthError(null)
                      setAuthNotice(null)
                    }}
                    className="text-xs font-medium text-slate-500 transition hover:text-brand-600"
                  >
                    {isRegisterMode ? (
                      <>Already have an account? <span className="font-semibold text-brand-600">Sign in</span></>
                    ) : (
                      <>Don't have an account? <span className="font-semibold text-brand-600">Create one</span></>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </Modal>
      )}

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
