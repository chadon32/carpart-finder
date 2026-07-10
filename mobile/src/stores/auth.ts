import { create } from 'zustand'
import * as api from '../api/client'
import { ApiError } from '../api/client'
import type { AuthUser } from '../api/client'

type AuthState = {
  user: AuthUser | null
  // 'unknown' until the first /me check completes on launch.
  status: 'unknown' | 'signedOut' | 'signedIn'
  loadMe: (retryOnNetworkError?: boolean) => Promise<void>
  login: (email: string, password: string) => Promise<{ confirmationRequired?: boolean }>
  signup: (email: string, password: string, name?: string) => Promise<{ confirmationRequired?: boolean }>
  logout: () => Promise<void>
}

export const useAuth = create<AuthState>()((set, get) => ({
  user: null,
  status: 'unknown',
  loadMe: async (retryOnNetworkError = true) => {
    try {
      const { user } = await api.getMe()
      set({ user, status: 'signedIn' })
    } catch (e) {
      // Only a definitive 401 means signed out. A network blip or 5xx gets
      // one delayed retry before falling back, so a launch-time hiccup
      // doesn't flip a valid session to the login form.
      if (e instanceof ApiError && e.status === 401) {
        set({ user: null, status: 'signedOut' })
      } else if (retryOnNetworkError) {
        setTimeout(() => {
          get().loadMe(false)
        }, 3000)
      } else {
        set({ user: null, status: 'signedOut' })
      }
    }
  },
  login: async (email, password) => {
    const r = await api.login(email, password)
    if (!r.confirmationRequired) set({ user: r.user, status: 'signedIn' })
    return { confirmationRequired: r.confirmationRequired }
  },
  signup: async (email, password, name) => {
    const r = await api.signup(email, password, name)
    if (!r.confirmationRequired) set({ user: r.user, status: 'signedIn' })
    return { confirmationRequired: r.confirmationRequired }
  },
  logout: async () => {
    try {
      await api.logout()
    } finally {
      set({ user: null, status: 'signedOut' })
    }
  },
}))
