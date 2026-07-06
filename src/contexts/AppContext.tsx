import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

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
