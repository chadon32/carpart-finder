import { useAuth } from '../auth'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCompare } from '../compare'
import { useGarage } from '../garage'
import { usePrefs } from '../prefs'
import { useRecents } from '../recents'
import { useWatchlist } from '../watchlist'
import { LOCAL_USER_DATA_KEYS } from '../../lib/clearLocalUserData'
import type { Listing } from '../../api/types'

const mockFetch = jest.fn()
globalThis.fetch = mockFetch as unknown as typeof fetch

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  Promise.resolve({ ok, status, json: () => Promise.resolve(body) })

beforeEach(async () => {
  mockFetch.mockReset()
  await AsyncStorage.clear()
  useAuth.setState({
    user: null,
    status: 'unknown',
    reauthEmail: null,
    deletionRecovered: false,
    deletionCleanupFailed: false,
  })
  useGarage.setState({ vehicles: [] })
  useRecents.setState({ searches: [] })
  useWatchlist.setState({ items: [] })
  useCompare.setState({ listings: [] })
  usePrefs.setState({ zip: '', hydrated: true })
})

test('login success signs in and sends credentials', async () => {
  mockFetch.mockReturnValue(jsonResponse({ user: { id: 'u1', email: 'a@b.c' } }))
  await useAuth.getState().login('a@b.c', 'password123')
  expect(useAuth.getState().status).toBe('signedIn')
  expect(useAuth.getState().user?.email).toBe('a@b.c')
  const [, init] = mockFetch.mock.calls[0]
  expect(init.credentials).toBe('include')
})

test('signup needing email confirmation does not sign in', async () => {
  mockFetch.mockReturnValue(jsonResponse({ user: { id: 'u1' }, confirmationRequired: true }))
  const r = await useAuth.getState().signup('a@b.c', 'password123')
  expect(r.confirmationRequired).toBe(true)
  expect(useAuth.getState().status).toBe('unknown')
})

test('failed me check resolves to signedOut', async () => {
  mockFetch.mockReturnValue(jsonResponse({ error: 'Not authenticated' }, false, 401))
  await useAuth.getState().loadMe()
  expect(useAuth.getState().status).toBe('signedOut')
})

test('login failure surfaces the server message and stays signed out', async () => {
  mockFetch.mockReturnValue(jsonResponse({ error: 'Invalid login credentials' }, false, 400))
  await expect(useAuth.getState().login('a@b.c', 'password123')).rejects.toThrow(
    'Invalid login credentials'
  )
  expect(useAuth.getState().user).toBeNull()
})

test('ordinary logout clears all audited local user data before switching accounts', async () => {
  const car = { year: '2020', make: 'Toyota', model: 'Camry', trim: 'LE', vin: 'VIN123' }
  const listing = {
    id: 'listing-1', title: 'Brake Pads', price: 40, currency: 'USD', condition: 'New',
    seller: 'seller', sellerFeedbackPercentage: '99', image: null, link: 'https://example.com',
    source: 'eBay', crossBorder: false,
  } as Listing
  useGarage.getState().addVehicle(car)
  useRecents.getState().record(car, 'Brake Pads')
  useWatchlist.getState().watch(listing, '2020 Toyota Camry', 'Brake Pads')
  useCompare.getState().toggle(listing)
  usePrefs.getState().setZip('85001')
  await AsyncStorage.multiSet(LOCAL_USER_DATA_KEYS.map((key) => [key, 'sensitive-data']))
  useAuth.setState({ user: { id: 'u1', email: 'a@b.c' }, status: 'signedIn' })
  mockFetch.mockReturnValue(jsonResponse({ success: true }))

  await useAuth.getState().logout()

  expect(useAuth.getState().status).toBe('signedOut')
  expect(useGarage.getState().vehicles).toEqual([])
  expect(useRecents.getState().searches).toEqual([])
  expect(useWatchlist.getState().items).toEqual([])
  expect(useCompare.getState().listings).toEqual([])
  expect(usePrefs.getState().zip).toBe('')
  await expect(AsyncStorage.multiGet([...LOCAL_USER_DATA_KEYS])).resolves.toEqual(
    LOCAL_USER_DATA_KEYS.map((key) => [key, null])
  )
})

test('logout still clears local data when the server cannot be reached', async () => {
  useGarage.getState().addVehicle({ year: '2020', make: 'Toyota', model: 'Camry', trim: '' })
  useAuth.setState({ user: { id: 'u1', email: 'a@b.c' }, status: 'signedIn' })
  mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'))

  await expect(useAuth.getState().logout()).rejects.toThrow(/server could not confirm/i)
  expect(useAuth.getState().status).toBe('signedOut')
  expect(useGarage.getState().vehicles).toEqual([])
})

test('successful deletion clears the session and calls server logout', async () => {
  useAuth.setState({ user: { id: 'u1', email: 'a@b.c' }, status: 'signedIn' })
  mockFetch
    .mockReturnValueOnce(jsonResponse({ receipt: 'signed-receipt', expiresInMs: 900_000 }))
    .mockReturnValueOnce(jsonResponse({ success: true }))
    .mockReturnValueOnce(jsonResponse({ success: true }))

  await useAuth.getState().deleteAccount('DELETE')

  expect(useAuth.getState().status).toBe('signedOut')
  expect(useAuth.getState().user).toBeNull()
  expect(mockFetch).toHaveBeenCalledTimes(3)
  expect(mockFetch.mock.calls[0][0]).toContain('/api/supabase/account/deletion-intent')
  expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ confirmation: 'DELETE' })
  expect(mockFetch.mock.calls[1][0]).toContain('/api/supabase/account')
  expect(mockFetch.mock.calls[1][1].method).toBe('DELETE')
  expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toEqual({
    confirmation: 'DELETE',
    receipt: 'signed-receipt',
  })
  expect(mockFetch.mock.calls[2][0]).toContain('/api/supabase/logout')
})

test('failed deletion keeps the signed-in session', async () => {
  useAuth.setState({ user: { id: 'u1', email: 'a@b.c' }, status: 'signedIn' })
  mockFetch
    .mockReturnValueOnce(jsonResponse({ receipt: 'signed-receipt', expiresInMs: 900_000 }))
    .mockReturnValueOnce(jsonResponse({ error: 'Could not remove your account data. Please try again.' }, false, 500))
    .mockReturnValueOnce(jsonResponse({ success: true, deleted: false }))

  await expect(useAuth.getState().deleteAccount('DELETE')).rejects.toThrow(/Could not remove/)
  expect(useAuth.getState().status).toBe('signedIn')
  expect(mockFetch).toHaveBeenCalledTimes(3)
  await expect(AsyncStorage.getItem('cpr-pending-account-deletion')).resolves.toBe('signed-receipt')
})

test('expired deletion session signs out locally and requires reauthentication', async () => {
  useAuth.setState({ user: { id: 'u1', email: 'a@b.c' }, status: 'signedIn' })
  mockFetch.mockReturnValueOnce(jsonResponse({ error: 'Invalid or expired token' }, false, 401))

  await expect(useAuth.getState().deleteAccount('DELETE')).rejects.toThrow(/expired token/)
  expect(useAuth.getState().status).toBe('signedOut')
  expect(useAuth.getState().reauthEmail).toBe('a@b.c')
})

test('network error does not clear local account state', async () => {
  useAuth.setState({ user: { id: 'u1', email: 'a@b.c' }, status: 'signedIn' })
  mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'))

  await expect(useAuth.getState().deleteAccount('DELETE')).rejects.toThrow(/check your connection/i)
  expect(useAuth.getState().status).toBe('signedIn')
})

test('already-deleted account response completes local cleanup idempotently', async () => {
  useAuth.setState({ user: { id: 'u1', email: 'a@b.c' }, status: 'signedIn' })
  mockFetch
    .mockReturnValueOnce(jsonResponse({ receipt: 'signed-receipt', expiresInMs: 900_000 }))
    .mockReturnValueOnce(jsonResponse({ success: true, alreadyDeleted: true }))
    .mockReturnValueOnce(jsonResponse({ success: true }))

  await useAuth.getState().deleteAccount('DELETE')
  expect(useAuth.getState().status).toBe('signedOut')
})

test('multiple rapid deletion calls share one request', async () => {
  useAuth.setState({ user: { id: 'u1', email: 'a@b.c' }, status: 'signedIn' })
  let resolveDelete: (value: unknown) => void = () => undefined
  const pendingDelete = new Promise((resolve) => {
    resolveDelete = resolve
  })
  mockFetch
    .mockReturnValueOnce(jsonResponse({ receipt: 'signed-receipt', expiresInMs: 900_000 }))
    .mockReturnValueOnce(pendingDelete)
    .mockReturnValueOnce(jsonResponse({ success: true }))

  const first = useAuth.getState().deleteAccount('DELETE')
  const second = useAuth.getState().deleteAccount('DELETE')
  expect(first).toBe(second)
  await new Promise<void>((resolve) => setImmediate(() => resolve()))
  expect(mockFetch).toHaveBeenCalledTimes(2)
  resolveDelete(jsonResponse({ success: true }))
  await Promise.all([first, second])
  expect(mockFetch).toHaveBeenCalledTimes(3)
  expect(mockFetch.mock.calls.filter(([, init]) => init.method === 'DELETE')).toHaveLength(1)
})

test('a lost deletion response is reconciled without impossible reauthentication', async () => {
  useAuth.setState({ user: { id: 'u1', email: 'a@b.c' }, status: 'signedIn' })
  mockFetch
    .mockReturnValueOnce(jsonResponse({ receipt: 'signed-receipt', expiresInMs: 900_000 }))
    .mockReturnValueOnce(jsonResponse({ error: 'Invalid or expired token' }, false, 401))
    .mockReturnValueOnce(jsonResponse({ success: true, deleted: true }))
    .mockReturnValueOnce(jsonResponse({ success: true }))

  await useAuth.getState().deleteAccount('DELETE')

  expect(useAuth.getState().status).toBe('signedOut')
  expect(useAuth.getState().reauthEmail).toBeNull()
  expect(useAuth.getState().deletionRecovered).toBe(true)
  await expect(AsyncStorage.getItem('cpr-pending-account-deletion')).resolves.toBeNull()
})

test('launch recovers a deletion that completed after the app closed', async () => {
  await AsyncStorage.setItem('cpr-pending-account-deletion', 'signed-receipt')
  useAuth.setState({ user: { id: 'u1', email: 'a@b.c' }, status: 'unknown' })
  mockFetch
    .mockReturnValueOnce(jsonResponse({ success: true, deleted: true }))
    .mockReturnValueOnce(jsonResponse({ success: true }))

  await useAuth.getState().loadMe()

  expect(useAuth.getState().status).toBe('signedOut')
  expect(useAuth.getState().deletionRecovered).toBe(true)
  expect(mockFetch).toHaveBeenCalledTimes(2)
  expect(mockFetch.mock.calls[0][0]).toContain('/api/supabase/account/deletion-status')
  expect(mockFetch.mock.calls.some(([url]) => String(url).endsWith('/me'))).toBe(false)
})
