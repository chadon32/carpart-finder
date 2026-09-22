import { Alert, Linking } from 'react-native'
import { openPrivacyPolicy, PRIVACY_POLICY_URL } from '../legal'

afterEach(() => {
  jest.restoreAllMocks()
})

test('opens the privacy policy URL', async () => {
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(true)

  await expect(openPrivacyPolicy()).resolves.toBe(true)
  expect(openURL).toHaveBeenCalledWith(PRIVACY_POLICY_URL)
})

test('shows an alert when the privacy policy cannot be opened', async () => {
  jest.spyOn(Linking, 'openURL').mockRejectedValueOnce(new Error('No browser'))
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)

  await expect(openPrivacyPolicy()).resolves.toBe(false)
  expect(alert).toHaveBeenCalledWith(
    'Unable to open Privacy Policy',
    'Please check your connection and try again.'
  )
})
