import { fireEvent, render, waitFor } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { router } from 'expo-router'
import DeleteAccountScreen from '../delete-account'
import { useAuth } from '@/stores/auth'

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    dismissAll: jest.fn(),
    replace: jest.fn(),
  },
}))

const mockFetch = jest.fn()
globalThis.fetch = mockFetch as unknown as typeof fetch

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  Promise.resolve({ ok, status, json: () => Promise.resolve(body) })

beforeEach(() => {
  mockFetch.mockReset()
  jest.clearAllMocks()
  ;(AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined)
  useAuth.setState({ user: { id: 'u1', email: 'driver@example.com' }, status: 'signedIn', reauthEmail: null })
})

test('Cancel backs out without calling the deletion endpoint', async () => {
  const screen = await render(<DeleteAccountScreen />)

  await fireEvent.press(screen.getByText('Cancel'))

  expect(router.back).toHaveBeenCalledTimes(1)
  expect(mockFetch).not.toHaveBeenCalled()
})

test('delete button without DELETE only shows confirmation guidance', async () => {
  const screen = await render(<DeleteAccountScreen />)

  await fireEvent.press(screen.getByText('Delete My Account'))

  await waitFor(() => expect(screen.getByText('Type DELETE exactly to confirm.')).toBeTruthy())
  expect(mockFetch).not.toHaveBeenCalled()
})

test('signed-out deep link requires authentication before deletion', async () => {
  useAuth.setState({ user: null, status: 'signedOut', reauthEmail: null })
  const screen = await render(<DeleteAccountScreen />)

  expect(screen.getByText('Sign in again')).toBeTruthy()
  expect(screen.getByLabelText('Type DELETE to confirm').props.editable).toBe(false)
  expect(mockFetch).not.toHaveBeenCalled()
})

test('successful deletion shows a persistent signed-out success destination', async () => {
  mockFetch
    .mockReturnValueOnce(jsonResponse({ success: true }))
    .mockReturnValueOnce(jsonResponse({ success: true }))
  const screen = await render(<DeleteAccountScreen />)

  await fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm'), 'DELETE')
  await fireEvent.press(screen.getByText('Delete My Account'))

  await waitFor(() => expect(router.dismissAll).toHaveBeenCalledTimes(1))
  expect(router.replace).toHaveBeenCalledWith({ pathname: '/account', params: { outcome: 'deleted' } })
  expect(useAuth.getState().status).toBe('signedOut')
})

test('failed deletion keeps the screen available for a safe retry', async () => {
  mockFetch.mockReturnValueOnce(
    jsonResponse({ error: 'Could not remove your account data. Please try again.' }, false, 500)
  )
  const screen = await render(<DeleteAccountScreen />)

  await fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm'), 'DELETE')
  await fireEvent.press(screen.getByText('Delete My Account'))

  await waitFor(() => expect(screen.getByText('We could not delete your account. Please try again.')).toBeTruthy())
  expect(router.replace).not.toHaveBeenCalled()
  expect(useAuth.getState().status).toBe('signedIn')
})

test('expired session provides a direct reauthentication path', async () => {
  mockFetch.mockReturnValueOnce(jsonResponse({ error: 'Invalid or expired token' }, false, 401))
  const screen = await render(<DeleteAccountScreen />)

  await fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm'), 'DELETE')
  await fireEvent.press(screen.getByText('Delete My Account'))

  await waitFor(() => expect(screen.getByText('Sign in again')).toBeTruthy())
  expect(screen.getByText(/session expired/i)).toBeTruthy()
  await fireEvent.press(screen.getByText('Sign in again'))
  expect(router.replace).toHaveBeenCalledWith({ pathname: '/account', params: { action: 'reauth-delete' } })
})

test('network failure explains that retrying is safe', async () => {
  mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'))
  const screen = await render(<DeleteAccountScreen />)

  await fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm'), 'DELETE')
  await fireEvent.press(screen.getByText('Delete My Account'))

  await waitFor(() => expect(screen.getByText(/retrying is safe/i)).toBeTruthy())
  expect(router.replace).not.toHaveBeenCalled()
})

test('completed deletion reports a local cache cleanup failure honestly', async () => {
  mockFetch
    .mockReturnValueOnce(jsonResponse({ success: true }))
    .mockReturnValueOnce(jsonResponse({ success: true }))
  ;(AsyncStorage.multiRemove as jest.Mock).mockRejectedValueOnce(new Error('Storage unavailable'))
  const screen = await render(<DeleteAccountScreen />)

  await fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm'), 'DELETE')
  await fireEvent.press(screen.getByText('Delete My Account'))

  await waitFor(() => expect(router.dismissAll).toHaveBeenCalledTimes(1))
  expect(router.replace).toHaveBeenCalledWith({
    pathname: '/account',
    params: { outcome: 'deleted', cleanup: 'failed' },
  })
  expect(useAuth.getState().status).toBe('signedOut')
})
