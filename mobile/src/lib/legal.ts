import { Alert, Linking } from 'react-native'

export const PRIVACY_POLICY_URL = 'https://carpartsradar.com/privacy.html'

export async function openPrivacyPolicy(): Promise<boolean> {
  try {
    await Linking.openURL(PRIVACY_POLICY_URL)
    return true
  } catch {
    Alert.alert(
      'Unable to open Privacy Policy',
      'Please check your connection and try again.'
    )
    return false
  }
}
