import { create } from 'zustand'
import * as api from '../api/client'
import { ApiError } from '../api/client'
import type { AuthUser } from '../api/client'
import { clearLocalUserData } from '../lib/clearLocalUserData'

type AuthState = {
  user: AuthUser | null
  // 'unknown' until the first /me check completes on launch.
  status: 'unknown' | 'signedOut' | 'signedIn'
  loadMe: (retryOnNetworkError?: boolean) => Promise<void>
  login: (email: string, password: string) => Promise<{ confirmationRequired?: boolean }>
  signup: (email: string, password: string, name?: string) => Promise<{ confirmationRequired?: boolean }>
  logout: () => Promise<void>
  deleteAccount: (confirmation: string) => Promise<void>
}

let deleteInFlight: Promise<void> | null = null

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
  deleteAccount: (confirmation) => {
    if (deleteInFlight) return deleteInFlight

    const operation = (async () => {
      try {
        await api.deleteAccount(confirmation)
      } catch (e) {
        // A 401 means the access token is stale; do not clear local data or
        // pretend the account was deleted. The UI will ask the user to log in
        // again before retrying.
        if (e instanceof ApiError && e.status === 401) {
          set({ user: null, status: 'signedOut' })
        }
        throw e
      }

      let cleanupError: unknown = null
      try {
        await clearLocalUserData()
      } catch (e) {
        cleanupError = e
      } finally {
        // The delete endpoint also clears the cookie, but keep logout in the
        // success path so a stale client cookie is removed immediately.
        try {
          await api.logout()
        } catch {
          // The server-side account is already gone. The local auth state is
          // still cleared even if this best-effort cookie clear cannot reach
          // the network.
        }
        set({ user: null, status: 'signedOut' })
      }

      if (cleanupError) {
        throw new Error('Your account was deleted, but this device could not clear its cached data.')
      }
    })()

    deleteInFlight = operation
    void operation.then(
      () => {
        if (deleteInFlight === operation) deleteInFlight = null
      },
      () => {
        if (deleteInFlight === operation) deleteInFlight = null
      }
    )
    return operation
  },
}))
