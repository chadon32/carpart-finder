import { createContext, type Dispatch, type SetStateAction } from 'react'

export interface User {
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

export interface AccountData {
  searches: SavedSearch[]
  alerts: PriceAlert[]
}

export interface AppContextType {
  user: User | null
  setUser: (user: User | null) => void
  accountData: AccountData | null
  setAccountData: Dispatch<SetStateAction<AccountData | null>>
  darkMode: boolean
  setDarkMode: (mode: boolean) => void
}

export const AppContext = createContext<AppContextType | undefined>(undefined)
