import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import DeleteAccountScreen from '../delete-account'

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    dismissAll: jest.fn(),
    replace: jest.fn(),
  },
}))

const mockFetch = jest.fn()
globalThis.fetch = mockFetch as unknown as typeof fetch

beforeEach(() => {
  mockFetch.mockReset()
  jest.clearAllMocks()
})

test('Cancel backs out without calling the deletion endpoint', async () => {
  const screen = await render(<DeleteAccountScreen />)

  fireEvent.press(screen.getByText('Cancel'))

  expect(router.back).toHaveBeenCalledTimes(1)
  expect(mockFetch).not.toHaveBeenCalled()
})

test('delete button without DELETE only shows confirmation guidance', async () => {
  const screen = await render(<DeleteAccountScreen />)

  fireEvent.press(screen.getByText('Delete My Account'))

  await waitFor(() => expect(screen.getByText('Type DELETE exactly to confirm.')).toBeTruthy())
  expect(mockFetch).not.toHaveBeenCalled()
})
