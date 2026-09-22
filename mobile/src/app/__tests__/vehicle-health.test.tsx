import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { Alert, Linking } from 'react-native'
import { fetchRecalls } from '@/api/client'
import VehicleHealth from '../vehicle-health'

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => ({ year: '2020', make: 'Toyota', model: 'Camry', trim: 'LE' }),
  useFocusEffect: (callback: () => () => void) => {
    const React = require('react')
    React.useEffect(callback, [callback])
  },
}))

jest.mock('@/api/client', () => ({ fetchRecalls: jest.fn() }))
const mockRecalls = jest.mocked(fetchRecalls)

beforeEach(() => mockRecalls.mockReset())
afterEach(() => jest.restoreAllMocks())

test('an empty model lookup is not presented as VIN-specific safety clearance', async () => {
  mockRecalls.mockResolvedValue({ recalls: [] })
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
  const screen = await render(<VehicleHealth />)

  await screen.findByText(/No recall notices were returned for this model/)
  expect(screen.queryByText(/No open recalls/i)).toBeNull()
  expect(screen.getByText(/not your VIN's repair status/)).toBeTruthy()
  await fireEvent.press(screen.getByRole('link', { name: 'Check your VIN on NHTSA' }))
  expect(openURL).toHaveBeenCalledWith('https://www.nhtsa.gov/recalls')
})

test('a failed lookup can be retried without losing the vehicle', async () => {
  mockRecalls.mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce({
    recalls: [{
      campaignNumber: 'TEST-001', component: 'Fixture component', summary: 'Fixture summary',
      consequence: null, remedy: 'Contact the manufacturer.', reportedDate: null,
    }],
  })
  const screen = await render(<VehicleHealth />)
  await screen.findByText(/this does NOT mean there are no recalls/)
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }))

  await screen.findByText('Fixture component')
  expect(screen.queryByRole('alert')).toBeNull()
  expect(mockRecalls).toHaveBeenCalledTimes(2)
  expect(mockRecalls.mock.calls[1].slice(0, 3)).toEqual(['2020', 'Toyota', 'Camry'])
})

test('leaving the screen cancels its pending recall request', async () => {
  mockRecalls.mockImplementation(() => new Promise(() => {}))
  const screen = await render(<VehicleHealth />)
  expect(screen.getByLabelText('Loading model recall notices')).toBeTruthy()
  const signal = mockRecalls.mock.calls[0][3]!
  expect(signal.aborted).toBe(false)
  await screen.unmount()
  expect(signal.aborted).toBe(true)
})

test('an unavailable browser provides a manual recall-check recovery action', async () => {
  mockRecalls.mockResolvedValue({ recalls: [] })
  jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('Unavailable'))
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  const screen = await render(<VehicleHealth />)
  await fireEvent.press(screen.getByRole('link', { name: 'Check your VIN on NHTSA' }))
  await waitFor(() => expect(alert).toHaveBeenCalledWith(
    'Could not open NHTSA',
    'Open https://www.nhtsa.gov/recalls in your browser to check your VIN.',
  ))
})
