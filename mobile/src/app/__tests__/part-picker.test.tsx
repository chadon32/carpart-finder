import { act, fireEvent, render, userEvent, waitFor } from '@testing-library/react-native'
import PartPicker from '../part-picker'
import { identifyPartFromImage } from '@/api/client'

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => ({ year: '2020', make: 'Honda', model: 'Civic', trim: 'EX' }),
}))

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
}))

jest.mock('expo-image-picker', () => ({
  __esModule: true,
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchCameraAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///part.jpg' }],
  }),
}))

jest.mock('expo-image-manipulator', () => ({
  __esModule: true,
  SaveFormat: { JPEG: 'jpeg' },
  manipulateAsync: jest.fn().mockResolvedValue({ base64: 'photo-data' }),
}))

jest.mock('@/api/client', () => ({
  identifyPartFromImage: jest.fn(),
}))

beforeEach(() => {
  jest.clearAllMocks()
})

const getMockPush = () => require('expo-router').router.push as jest.Mock

test('photo identification exposes a visible search action that uses the normalized suggestion', async () => {
  jest.mocked(identifyPartFromImage).mockResolvedValue({ identified: true, partName: '  Brake   Rotor  ' })
  const screen = await render(<PartPicker />)

  await fireEvent.press(screen.getByRole('button', { name: 'Get an AI part suggestion from a photo' }))

  await waitFor(() => expect(screen.getByText('AI suggestion: Brake Rotor. Review or edit it, then search to confirm.')).toBeTruthy())
  expect(identifyPartFromImage).toHaveBeenCalledWith('data:image/jpeg;base64,photo-data')
  const searchButton = screen.getByRole('button', { name: 'Search listings' })
  expect(searchButton.props.accessibilityState.disabled).toBe(false)

  await fireEvent.press(searchButton)

  expect(getMockPush()).toHaveBeenCalledWith({
    pathname: '/results',
    params: { year: '2020', make: 'Honda', model: 'Civic', trim: 'EX', part: 'Brake Rotor' },
  })
})

test('search listings is disabled for an empty or whitespace-only query', async () => {
  const screen = await render(<PartPicker />)
  const input = screen.getByLabelText('Search by part name or original equipment number')
  const searchButton = screen.getByRole('button', { name: 'Search listings' })

  expect(searchButton.props.accessibilityState.disabled).toBe(true)
  await fireEvent.changeText(input, '   ')
  expect(screen.getByRole('button', { name: 'Search listings' }).props.accessibilityState.disabled).toBe(true)
})

test('keyboard submit continues to search using the normalized query', async () => {
  const screen = await render(<PartPicker />)
  const input = screen.getByLabelText('Search by part name or original equipment number')

  await fireEvent.changeText(input, '  Brake   Pads ')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Search listings' }).props.accessibilityState.disabled).toBe(false))
  await fireEvent(input, 'submitEditing')

  expect(getMockPush()).toHaveBeenCalledWith({
    pathname: '/results',
    params: { year: '2020', make: 'Honda', model: 'Civic', trim: 'EX', part: 'Brake Pads' },
  })
})

test('camera launch failures recover without an unhandled rejection or stuck busy state', async () => {
  const picker = require('expo-image-picker')
  picker.launchCameraAsync.mockRejectedValueOnce(new Error('Camera unavailable'))
  const screen = await render(<PartPicker />)
  await fireEvent.press(screen.getByRole('button', { name: 'Get an AI part suggestion from a photo' }))
  await waitFor(() => expect(screen.getByText(/Photo identification failed/)).toBeTruthy())
  expect(screen.getByRole('button', { name: 'Get an AI part suggestion from a photo' }).props.accessibilityState.disabled).toBe(false)
})

test('identification blocks repeat taps and keyboard search until the active operation finishes', async () => {
  let finish!: (value: { identified: boolean; partName: string }) => void
  jest.mocked(identifyPartFromImage).mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
  const picker = require('expo-image-picker')
  const screen = await render(<PartPicker />)
  const photo = screen.getByRole('button', { name: 'Get an AI part suggestion from a photo' })
  const user = userEvent.setup()
  await user.press(photo)
  await waitFor(() => expect(identifyPartFromImage).toHaveBeenCalledTimes(1))
  await user.press(photo)
  expect(picker.launchCameraAsync).toHaveBeenCalledTimes(1)
  const input = screen.getByLabelText('Search by part name or original equipment number')
  await fireEvent.changeText(input, 'Brake Pads')
  expect(screen.getByRole('button', { name: 'Search listings' }).props.accessibilityState.disabled).toBe(true)
  await fireEvent(input, 'submitEditing')
  expect(getMockPush()).not.toHaveBeenCalled()
  await act(async () => { finish({ identified: true, partName: 'Brake Rotor' }) })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Search listings' }).props.accessibilityState.disabled).toBe(false))
})
