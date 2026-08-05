import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import AccountScreen from '../account'
import { useAuth } from '@/stores/auth'

let mockParams: { outcome?: string; action?: string; cleanup?: string } = {}

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: jest.fn(),
}))

const mockFetch = jest.fn()
globalThis.fetch = mockFetch as unknown as typeof fetch

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  Promise.resolve({ ok, status, json: () => Promise.resolve(body) })

beforeEach(() => {
  mockParams = {}
  mockFetch.mockReset()
  jest.clearAllMocks()
  useAuth.setState({ user: null, status: 'signedOut', reauthEmail: null })
})

test('signed-out account route shows authentication instead of stale account actions', async () => {
  const screen = await render(<AccountScreen />)

  expect(screen.getByText('Sign in to manage your account and data.')).toBeTruthy()
  expect(screen.getByLabelText('Email address')).toBeTruthy()
  expect(screen.queryByText('Delete Account')).toBeNull()
})

test('post-deletion route keeps the permanent deletion confirmation visible', async () => {
  mockParams = { outcome: 'deleted' }
  const screen = await render(<AccountScreen />)

  expect(screen.getByText('Account permanently deleted')).toBeTruthy()
  expect(screen.getByText(/Your account has been permanently deleted/)).toBeTruthy()
  expect(screen.getByLabelText('Email address')).toBeTruthy()
})

test('post-deletion route distinguishes a local cache cleanup failure', async () => {
  mockParams = { outcome: 'deleted', cleanup: 'failed' }
  const screen = await render(<AccountScreen />)

  expect(screen.getByText('Account permanently deleted')).toBeTruthy()
  expect(screen.getByText('Device cleanup needs attention')).toBeTruthy()
  expect(screen.getByText(/remove and reinstall the app/i)).toBeTruthy()
})

test('reauthentication returns directly to account deletion', async () => {
  mockParams = { action: 'reauth-delete' }
  useAuth.setState({ reauthEmail: 'driver@example.com' })
  mockFetch.mockReturnValueOnce(jsonResponse({ user: { id: 'u1', email: 'driver@example.com' } }))
  const screen = await render(<AccountScreen />)

  expect(screen.getByText(/session expired/i)).toBeTruthy()
  expect(screen.getByLabelText('Email address').props.value).toBe('driver@example.com')
  expect(screen.queryByText('New here? Create an account')).toBeNull()
  await fireEvent.changeText(screen.getByLabelText('Password'), 'password123')
  await fireEvent.press(screen.getByText('Log in'))

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/delete-account'))
  expect(useAuth.getState().status).toBe('signedIn')
})

test('deletion reauthentication rejects a different account email', async () => {
  mockParams = { action: 'reauth-delete' }
  useAuth.setState({ reauthEmail: 'driver@example.com' })
  const screen = await render(<AccountScreen />)

  await fireEvent.changeText(screen.getByLabelText('Email address'), 'other@example.com')
  await fireEvent.changeText(screen.getByLabelText('Password'), 'password123')
  await fireEvent.press(screen.getByText('Log in'))

  expect(screen.getByText('Sign in with driver@example.com to continue account deletion.')).toBeTruthy()
  expect(mockFetch).not.toHaveBeenCalled()
  expect(router.replace).not.toHaveBeenCalled()
  expect(useAuth.getState().status).toBe('signedOut')
})

test('signed-in account route exposes permanent deletion', async () => {
  useAuth.setState({ user: { id: 'u1', email: 'driver@example.com' }, status: 'signedIn' })
  const screen = await render(<AccountScreen />)

  expect(screen.getByText('driver@example.com')).toBeTruthy()
  await fireEvent.press(screen.getByText('Delete Account'))
  expect(router.push).toHaveBeenCalledWith('/delete-account')
})
