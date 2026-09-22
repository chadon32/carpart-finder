import { Alert } from 'react-native'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { AccountCard } from '../AccountCard'
import { useAuth } from '@/stores/auth'

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: jest.fn(),
}))

test('logout rejection explains that local data cleanup may need a retry', async () => {
  const logout = jest.fn().mockRejectedValue(new Error('Network request failed'))
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
  useAuth.setState({
    user: { id: 'u1', email: 'driver@example.com' },
    status: 'signedIn',
    reauthEmail: null,
    logout,
  })
  const screen = await render(<AccountCard />)

  await fireEvent.press(screen.getByText('Log out'))

  await waitFor(() => expect(alert).toHaveBeenCalledWith(
    'Sign out needs attention',
    'Network request failed'
  ))
  alert.mockRestore()
})
