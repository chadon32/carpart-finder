import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { getCurrentUser, logoutUser, ApiError } from '../api/supabase'

interface User {
  name: string
  email: string
}

export interface SavedSearch {
  id: string
  year: string
  make: string
  model: string
  trim?: string | null
  part: string
  created_at?: string
}

export interface PriceAlert {
  id: string
  saved_search_id?: string
  target_price: number
  triggered_at?: string | null
  last_price?: number | null
  saved_searches?: Pick<SavedSearch, 'part' | 'year' | 'make' | 'model'> | null
}

interface AccountData {
  searches: SavedSearch[]
  alerts: PriceAlert[]
}

interface AppContextType {
  user: User | null
  setUser: (user: User | null) => void
  accountData: AccountData | null
  setAccountData: React.Dispatch<React.SetStateAction<AccountData | null>>
  darkMode: boolean
  setDarkMode: (mode: boolean) => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('carpartsradar-user')
    if (!saved) return null
    try {
      const parsed = JSON.parse(saved)
      if (parsed && 'token' in parsed) {
        localStorage.removeItem('carpartsradar-user')
        return null
      }
      return parsed
    } catch {
      return null
    }
  })

  const [accountData, setAccountData] = useState<AccountData | null>(null)

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

  // A cached user in localStorage is a UI hint, never proof of a session. The
  // server holds the real answer in an httpOnly cookie we cannot read. Confirm
  // it once on boot and clear both sides if the session is gone — this is what
  // logs out anyone still holding a session minted by the old mock-mode auth,
  // which accepted any password for any email.
  //
  // Boot-only on purpose: re-running when `user` changes would clear the user
  // we just logged in, before the cookie round-trips.
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const isOauthCallback = searchParams.get('oauth') === 'true'

    if (!user && !isOauthCallback) return

    let cancelled = false

    if (isOauthCallback) {
      const newUrl = window.location.pathname
      window.history.replaceState({}, '', newUrl)
    }

    getCurrentUser()
      .then((res) => {
        if (cancelled) return
        if (isOauthCallback && res.user) {
          const newUser = {
            name: res.user.user_metadata?.full_name || res.user.email?.split('@')[0] || 'User',
            email: res.user.email || '',
          }
          localStorage.setItem('carpartsradar-user', JSON.stringify(newUser))
          setUser(newUser)
        }
      })
      .catch(async (err) => {
        if (cancelled) return
        // Only a definitive answer from the server ends the session. A network
        // failure means we don't know, so keep the cached user rather than
        // logging someone out over a dropped connection.
        //   401/403 — the token is invalid or expired.
        //   503     — accounts are disabled; any session we hold is a mock relic.
        const definitive = err instanceof ApiError && [401, 403, 503].includes(err.status)
        if (!definitive) return

        await logoutUser() // clears the stale cpf_token cookie server-side
        localStorage.removeItem('carpartsradar-user')
        setUser(null)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AppContext.Provider value={{ user, setUser, accountData, setAccountData, darkMode, setDarkMode }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider')
  }
  return context
}
