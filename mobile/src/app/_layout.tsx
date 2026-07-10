import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router'
import { useColorScheme } from 'react-native'
import { useFonts, BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed'

export default function RootLayout() {
  const colorScheme = useColorScheme()
  const [fontsLoaded] = useFonts({ BarlowCondensed_700Bold })
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
      </Stack>
    </ThemeProvider>
  )
}
