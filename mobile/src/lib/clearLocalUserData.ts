import AsyncStorage from '@react-native-async-storage/async-storage'
import { useGarage } from '../stores/garage'
import { useRecents } from '../stores/recents'
import { useWatchlist } from '../stores/watchlist'
import { useCompare } from '../stores/compare'
import { usePrefs } from '../stores/prefs'

// Audited persisted stores. Keep this registry next to the deletion flow so a
// new local user-data store cannot be added without an explicit cleanup entry.
export const LOCAL_USER_DATA_KEYS = ['cpr-garage', 'cpr-recents', 'cpr-watchlist', 'cpr-prefs'] as const

export async function clearLocalUserData() {
  useGarage.getState().clear()
  useRecents.getState().clear()
  useWatchlist.getState().clear()
  useCompare.getState().clear()
  usePrefs.getState().reset()

  // The auth cookie is cleared separately by the server's logout endpoint.
  // There is no SecureStore/Keychain use in this app; this removes every
  // audited AsyncStorage item after resetting the in-memory stores.
  await AsyncStorage.multiRemove([...LOCAL_USER_DATA_KEYS])
}
