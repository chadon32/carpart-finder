import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router'
import { useColorScheme } from 'react-native'

export default function RootLayout() {
  const colorScheme = useColorScheme()
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="vehicle-picker" options={{ title: 'Select vehicle' }} />
        <Stack.Screen name="part-picker" options={{ title: 'Choose part' }} />
      </Stack>
    </ThemeProvider>
  )
}
