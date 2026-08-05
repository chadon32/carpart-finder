import { Platform } from 'react-native'

// Expo Router pre-renders web routes in a Node environment where AsyncStorage
// cannot access `window`. Native and client-side web builds hydrate normally.
export const skipServerWebHydration = Platform.OS === 'web' && typeof window === 'undefined'
