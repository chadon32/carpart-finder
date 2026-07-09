import { useState, useEffect } from 'react'
import { Trash2, ChevronLeft, LogOut, Search, Bell } from 'lucide-react'
import { toast } from 'sonner'
import { useAppContext } from '../contexts/AppContext'
import { getSavedSearches, getPriceAlerts, signupUser, loginUser, logoutUser, deleteSavedSearch, deletePriceAlert, ApiError } from '../api/supabase'

interface DashboardProps {
  onClose: () => void
  onRunSearch: (car: { year: string; make: string; model: string; trim?: string }, part: string) => void
}

export function Dashboard({ onClose, onRunSearch }: DashboardProps) {
  const { user, setUser, accountData, setAccountData } = useAppContext()
  const [accountTab, setAccountTab] = useState<'searches' | 'alerts'>('searches')
  
  // Auth state
  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authNotice, setAuthNotice] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)

  useEffect(() => {
    if (user) {
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
  }, [user, setAccountData])

  const handleLogout = async () => {
    setAuthLoading(true)
    try {
      await logoutUser()
      localStorage.removeItem('carpartsradar-user')
      setUser(null)
      toast.success('Logged out successfully')
    } catch (err: any) {
      toast.error(err.message || 'Failed to logout')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleAuth = async () => {
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

      if (res.confirmationRequired) {
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
      }

      localStorage.setItem('carpartsradar-user', JSON.stringify(newUser))
      setUser(newUser)

      setSignupName('')
      setSignupEmail('')
      setSignupPassword('')
      setAuthError(null)
      setAuthNotice(null)
    } catch (err: any) {
      // 503 means the server cannot verify credentials at all (Supabase is
      // unconfigured). Say so plainly instead of implying the credentials
      // were wrong — and point at what still works.
      if (err instanceof ApiError && err.status === 503) {
        setAuthError('Accounts are temporarily unavailable. Search and price comparison still work.')
      } else {
        setAuthError(err.message || 'Authentication failed.')
      }
    } finally {
      setAuthLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md card p-8 mt-12 animate-slide-up">
        <button onClick={onClose} className="btn btn-ghost -ml-3 mb-6 px-3 text-sm font-medium text-slate-500 hover:text-brand-600">
          <ChevronLeft size={16} /> Back to Search
        </button>
        <form onSubmit={(e) => { e.preventDefault(); handleAuth(); }}>
          <div className="mb-6 text-center">
            <h3 className="section-title dark:text-white">
              {isRegisterMode ? 'Create your account' : 'Welcome back'}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {isRegisterMode
                ? 'Save searches and get price-drop alerts.'
                : 'Sign in to your saved searches and alerts.'}
            </p>
          </div>

          {authError && (
            <p className="mb-4 animate-fade-in rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm font-medium text-rose-700">
              {authError}
            </p>
          )}

          {authNotice && (
            <p className="mb-4 animate-fade-in rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
              {authNotice}
            </p>
          )}

          <a
            href="/api/supabase/oauth/google"
            className="btn w-full py-3 mb-4 flex items-center justify-center gap-2 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition shadow-sm rounded-xl font-medium"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.16v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.16C1.43 8.55 1 10.22 1 12s.43 3.45 1.16 4.93l3.68-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.16 7.07l3.68 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </a>

          <div className="relative mb-6 flex items-center py-1">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
            <span className="shrink-0 px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Or</span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
          </div>

          {isRegisterMode && (
            <div className="mb-4">
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

          <div className="mb-4">
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

          <div className="mb-6">
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
            className="btn btn-primary w-full py-3"
          >
            {authLoading ? 'Please wait…' : isRegisterMode ? 'Create Account' : 'Sign In'}
          </button>

          <div className="mt-6 border-t border-slate-100 pt-5 text-center dark:border-slate-800/60">
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(!isRegisterMode)
                setAuthError(null)
                setAuthNotice(null)
              }}
              className="text-sm font-medium text-slate-500 transition hover:text-brand-600"
            >
              {isRegisterMode ? (
                <>Already have an account? <span className="font-bold text-brand-600">Sign in</span></>
              ) : (
                <>Don't have an account? <span className="font-bold text-brand-600">Create one</span></>
              )}
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl animate-slide-up">
      <div className="mb-6 flex items-center justify-between">
        <button onClick={onClose} className="btn btn-ghost -ml-3 px-3 text-sm font-medium text-slate-500 hover:text-brand-600">
          <ChevronLeft size={16} /> Back
        </button>
        <button onClick={handleLogout} disabled={authLoading} className="btn btn-ghost text-sm text-slate-500 hover:text-rose-600">
          <LogOut size={16} className="mr-1.5" /> Log Out
        </button>
      </div>

      <div className="card p-6 sm:p-8">
        <h2 className="section-title mb-2 dark:text-white">Welcome, {user.name.split(' ')[0]}</h2>
        <p className="text-sm text-slate-500 mb-8">Manage your saved searches and active price alerts.</p>

        {accountData ? (
          <div>
            <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6">
              <button
                type="button"
                onClick={() => setAccountTab('searches')}
                className={`tab text-base px-6 py-3 ${accountTab === 'searches' ? 'tab-active' : ''}`}
              >
                Saved Searches <span className="ml-2 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs">{accountData.searches.length}</span>
              </button>
              <button
                type="button"
                onClick={() => setAccountTab('alerts')}
                className={`tab text-base px-6 py-3 ${accountTab === 'alerts' ? 'tab-active' : ''}`}
              >
                Price Alerts <span className="ml-2 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs">{accountData.alerts.length}</span>
              </button>
            </div>

            <div className="min-h-[300px]">
              {accountTab === 'searches' ? (
                accountData.searches.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {accountData.searches.map((s: any, i: number) => (
                      <div
                        key={s.id ?? i}
                        className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm hover:border-brand-300 transition"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white truncate text-sm mb-1">{s.part}</div>
                          <div className="text-xs text-slate-500 font-medium truncate">
                            {s.year} {s.make} {s.model} {s.trim ? `· ${s.trim}` : ''}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => onRunSearch({ year: s.year, make: s.make, model: s.model, trim: s.trim || '' }, s.part)}
                            className="btn btn-primary px-3 py-1.5 text-xs"
                          >
                            Search Now
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await deleteSavedSearch(s.id)
                                setAccountData((prev) =>
                                  prev
                                    ? {
                                        searches: prev.searches.filter((x) => x.id !== s.id),
                                        alerts: prev.alerts.filter((a) => a.saved_search_id !== s.id),
                                      }
                                    : prev
                                )
                                toast.success('Search deleted')
                              } catch {
                                toast.error('Failed to delete search')
                              }
                            }}
                            className="text-xs font-semibold text-slate-400 hover:text-rose-600 text-right"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-14 text-center">
                    <div className="icon-tile mb-4 h-12 w-12 bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                      <Search size={22} />
                    </div>
                    <p className="font-semibold text-slate-700 dark:text-slate-200">No saved searches yet</p>
                    <p className="mt-1 max-w-xs text-sm text-slate-500">
                      Run a search and tap <span className="font-medium text-slate-600 dark:text-slate-300">Save Search</span> to keep it here for one-click access.
                    </p>
                    <button type="button" onClick={onClose} className="btn btn-secondary mt-5">Start a search</button>
                  </div>
                )
              ) : (
                accountData.alerts.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {accountData.alerts.map((a: any, i: number) => (
                      <div
                        key={a.id ?? i}
                        className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white truncate text-sm mb-1">
                            {a.saved_searches?.part || 'Part'}
                          </div>
                          <div className="text-xs text-slate-500 font-medium mb-3 truncate">
                            {a.saved_searches
                              ? `${a.saved_searches.year} ${a.saved_searches.make} ${a.saved_searches.model}`
                              : 'Vehicle'}
                          </div>
                          
                          <div className="inline-flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1.5">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Target: <span className="font-data">${a.target_price}</span></span>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end justify-between h-full shrink-0">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await deletePriceAlert(a.id)
                                setAccountData((prev) =>
                                  prev ? { ...prev, alerts: prev.alerts.filter((x) => x.id !== a.id) } : prev
                                )
                                toast.success('Alert deleted')
                              } catch {
                                toast.error('Failed to delete alert')
                              }
                            }}
                            className="btn btn-ghost p-1.5 text-slate-400 hover:text-rose-600 mb-2"
                          >
                            <Trash2 size={15} />
                          </button>
                          
                          {a.triggered_at ? (
                            <div className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-md">
                              ✓ Dropped to <span className="font-data">${Number(a.last_price).toFixed(2)}</span>
                            </div>
                          ) : a.last_price != null ? (
                            <div className="text-[10px] font-medium text-slate-500">
                              Checked: <span className="font-data">${Number(a.last_price).toFixed(2)}</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-14 text-center">
                    <div className="icon-tile mb-4 h-12 w-12 bg-amber-50 text-amber-500 dark:bg-amber-950/30 dark:text-amber-400">
                      <Bell size={22} />
                    </div>
                    <p className="font-semibold text-slate-700 dark:text-slate-200">No price alerts yet</p>
                    <p className="mt-1 max-w-xs text-sm text-slate-500">
                      Set a target price on any part and we'll email you the moment it drops below it.
                    </p>
                    <button type="button" onClick={onClose} className="btn btn-secondary mt-5">Find a part</button>
                  </div>
                )
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center" role="status" aria-label="Loading your account">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600 dark:border-slate-700 dark:border-t-brand-400" />
          </div>
        )}
      </div>
    </div>
  )
}
