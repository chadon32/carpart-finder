import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as api from '../api/client'
import { ApiError } from '../api/client'
import type { AuthUser } from '../api/client'
import { AccountDeletedLocalCleanupError } from '../lib/accountDeletion'
import {
  clearLocalUserData,
  PENDING_ACCOUNT_DELETION_RECEIPT_KEY,
} from '../lib/clearLocalUserData'

type AuthState = {
  user: AuthUser | null
  reauthEmail: string | null
  deletionRecovered: boolean
  deletionCleanupFailed: boolean
  // 'unknown' until the first /me check completes on launch.
  status: 'unknown' | 'signedOut' | 'signedIn'
  loadMe: (retryOnNetworkError?: boolean) => Promise<void>
  login: (email: string, password: string) => Promise<{ confirmationRequired?: boolean }>
  signup: (email: string, password: string, name?: string) => Promise<{ confirmationRequired?: boolean }>
  logout: () => Promise<void>
  deleteAccount: (confirmation: string) => Promise<void>
}

let deleteInFlight: Promise<void> | null = null

type PendingDeletionState = 'active' | 'deleted' | 'expired' | 'unknown'

async function pendingDeletionState(receipt: string): Promise<PendingDeletionState> {
  try {
    const status = await api.getAccountDeletionStatus(receipt)
    return status.deleted ? 'deleted' : 'active'
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) {
      await AsyncStorage.removeItem(PENDING_ACCOUNT_DELETION_RECEIPT_KEY)
      return 'expired'
    }
    return 'unknown'
  }
}

export const useAuth = create<AuthState>()((set, get) => ({
  user: null,
  reauthEmail: null,
  deletionRecovered: false,
  deletionCleanupFailed: false,
  status: 'unknown',
  loadMe: async (retryOnNetworkError = true) => {
    const pendingReceipt = await AsyncStorage.getItem(PENDING_ACCOUNT_DELETION_RECEIPT_KEY)
    if (pendingReceipt && await pendingDeletionState(pendingReceipt) === 'deleted') {
      let cleanupFailed = false
      try {
        await clearLocalUserData()
      } catch {
        cleanupFailed = true
      }
      try {
        await api.logout()
      } catch {
        // Best effort: the Auth identity is already gone.
      }
      set({
        user: null,
        status: 'signedOut',
        reauthEmail: null,
        deletionRecovered: true,
        deletionCleanupFailed: cleanupFailed,
      })
      return
    }

    try {
      const { user } = await api.getMe()
      set({
        user,
        status: 'signedIn',
        reauthEmail: null,
        deletionRecovered: false,
        deletionCleanupFailed: false,
      })
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
    if (!r.confirmationRequired) {
      set({ user: r.user, status: 'signedIn', reauthEmail: null, deletionRecovered: false, deletionCleanupFailed: false })
    }
    return { confirmationRequired: r.confirmationRequired }
  },
  signup: async (email, password, name) => {
    const r = await api.signup(email, password, name)
    if (!r.confirmationRequired) {
      set({ user: r.user, status: 'signedIn', reauthEmail: null, deletionRecovered: false, deletionCleanupFailed: false })
    }
    return { confirmationRequired: r.confirmationRequired }
  },
  logout: async () => {
    let serverError: unknown = null
    try {
      await api.logout()
    } catch (error) {
      serverError = error
    }

    let cleanupError: unknown = null
    try {
      await clearLocalUserData()
    } catch (error) {
      cleanupError = error
    } finally {
      set({ user: null, status: 'signedOut', reauthEmail: null, deletionRecovered: false, deletionCleanupFailed: false })
    }

    if (cleanupError) {
      throw new Error('You are signed out, but this device could not clear all local data. Reopen the app and retry before another person uses it.')
    }
    if (serverError) {
      throw new Error('Local app data was cleared, but the server could not confirm sign out. Reconnect and try again.')
    }
  },
  deleteAccount: (confirmation) => {
    if (deleteInFlight) return deleteInFlight

    const operation = (async () => {
      let receipt = await AsyncStorage.getItem(PENDING_ACCOUNT_DELETION_RECEIPT_KEY)
      let accountDeleted = false

      if (receipt) {
        const state = await pendingDeletionState(receipt)
        accountDeleted = state === 'deleted'
        if (state === 'expired') receipt = null
      }

      try {
        if (!accountDeleted) {
          if (!receipt) {
            const intent = await api.prepareAccountDeletion(confirmation)
            receipt = intent.receipt
            try {
              await AsyncStorage.setItem(PENDING_ACCOUNT_DELETION_RECEIPT_KEY, receipt)
            } catch {
              throw new Error('Could not safely prepare account deletion on this device. Free storage and try again.')
            }
          }
          await api.deleteAccount(confirmation, receipt)
          accountDeleted = true
        }
      } catch (e) {
        // The destructive request can finish after its HTTP response is lost.
        // Reconcile through the pre-issued signed receipt before treating a
        // 401 as a stale session or telling the user to retry.
        if (receipt && await pendingDeletionState(receipt) === 'deleted') {
          accountDeleted = true
        }
        if (!accountDeleted) {
          // A 401 means the access token is stale; do not clear local data or
          // pretend the account was deleted. The UI will ask the user to log in
          // again before retrying.
          if (e instanceof ApiError && e.status === 401) {
            set({
              user: null,
              status: 'signedOut',
              reauthEmail: get().user?.email ?? null,
              deletionRecovered: false,
              deletionCleanupFailed: false,
            })
          }
          throw e
        }
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
        set({
          user: null,
          status: 'signedOut',
          reauthEmail: null,
          deletionRecovered: true,
          deletionCleanupFailed: Boolean(cleanupError),
        })
      }

      if (cleanupError) {
        throw new AccountDeletedLocalCleanupError()
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
