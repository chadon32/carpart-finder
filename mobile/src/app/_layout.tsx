import { useEffect } from 'react'
import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router'
import { useColorScheme } from 'react-native'
import { useFonts, BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed'
import { JetBrainsMono_500Medium, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono'
import { useAuth } from '@/stores/auth'

export default function RootLayout() {
  const colorScheme = useColorScheme()
  const [fontsLoaded] = useFonts({
    BarlowCondensed_700Bold,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  })
  useEffect(() => {
    // Rehydrate the session from the persisted cookie, if any.
    useAuth.getState().loadMe()
  }, [])
  if (!fontsLoaded) return null
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="vehicle-picker" options={{ title: 'Select vehicle' }} />
        <Stack.Screen name="part-picker" options={{ title: 'Choose part' }} />
        <Stack.Screen name="results" options={{ title: 'Live listings' }} />
        <Stack.Screen name="listing-detail" options={{ title: 'Listing', presentation: 'modal' }} />
        <Stack.Screen name="compare" options={{ title: 'Compare', presentation: 'modal' }} />
        <Stack.Screen name="diagnose" options={{ title: 'Diagnose' }} />
        <Stack.Screen name="vehicle-health" options={{ title: 'Vehicle health' }} />
        <Stack.Screen name="repair-guide" options={{ title: 'Repair guide', presentation: 'modal' }} />
        <Stack.Screen name="profile" options={{ title: 'Profile' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="account" options={{ title: 'Account' }} />
        <Stack.Screen name="delete-account" options={{ title: 'Delete Account' }} />
      </Stack>
    </ThemeProvider>
  )
}
