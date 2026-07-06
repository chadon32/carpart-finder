import { useState, useEffect } from 'react'
import { Trash2, ChevronLeft, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { useAppContext } from '../contexts/AppContext'
import { getSavedSearches, getPriceAlerts, signupUser, loginUser, logoutUser, deleteSavedSearch, deletePriceAlert } from '../api/supabase'

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
      setAuthError(err.message || 'Authentication failed.')
    } finally {
      setAuthLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md card p-8 mt-12 animate-slide-up">
        <button onClick={onClose} className="mb-6 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-600 transition">
          <ChevronLeft size={16} /> Back to Search
        </button>
        <form onSubmit={(e) => { e.preventDefault(); handleAuth(); }}>
          <div className="mb-6 text-center">
            <h3 className="text-xl font-bold tracking-tight text-slate-950 dark:text-white">
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
        <button onClick={onClose} className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-600 transition">
          <ChevronLeft size={16} /> Back
        </button>
        <button onClick={handleLogout} disabled={authLoading} className="btn btn-ghost text-sm text-slate-500 hover:text-rose-600">
          <LogOut size={16} className="mr-1.5" /> Log Out
        </button>
      </div>

      <div className="card p-6 sm:p-8">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">Welcome, {user.name.split(' ')[0]}</h2>
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
                  <div className="flex h-40 items-center justify-center text-sm text-slate-500">No saved searches yet.</div>
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
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Target: ${a.target_price}</span>
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
                              ✓ Dropped to ${Number(a.last_price).toFixed(2)}
                            </div>
                          ) : a.last_price != null ? (
                            <div className="text-[10px] font-medium text-slate-400">
                              Checked: ${Number(a.last_price).toFixed(2)}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-40 items-center justify-center text-sm text-slate-500">No price alerts active yet.</div>
                )
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-slate-400">Loading dashboard...</div>
        )}
      </div>
    </div>
  )
}
