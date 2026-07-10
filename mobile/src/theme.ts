import { useColorScheme } from 'react-native'

export const brand = '#2050c8'

// The site's "Blueprint & Radar" display face: Barlow Condensed 700, always
// uppercase. Use for screen titles and the wordmark, never body text.
export const displayFont = 'BarlowCondensed_700Bold'

// The site's data/label face (.font-data / .eyebrow): JetBrains Mono. Use for
// uppercase eyebrows, badges, and price figures.
export const dataFont = 'JetBrainsMono_500Medium'
export const dataFontBold = 'JetBrainsMono_700Bold'

const light = {
  bg: '#fafafa',
  card: '#ffffff',
  text: '#0f172a',
  subtext: '#64748b',
  border: '#e2e8f0',
  brand,
}

const dark = {
  bg: '#0b1220',
  card: '#161e2e',
  text: '#f1f5f9',
  subtext: '#94a3b8',
  border: '#334155',
  brand: '#4f79e0',
}

export function useThemeColors() {
  return useColorScheme() === 'dark' ? dark : light
}
