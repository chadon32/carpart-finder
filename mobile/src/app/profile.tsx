import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { SettingsRow } from '@/components/SettingsRow'
import { useThemeColors, dataFont, displayFont } from '@/theme'

export default function ProfileScreen() {
  const c = useThemeColors()

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }}>
        <Text style={{ color: c.text, fontSize: 34, fontFamily: displayFont }}>PROFILE</Text>
        <View style={{ gap: 8 }}>
          <Text style={{ color: c.subtext, fontSize: 12, letterSpacing: 1, fontFamily: dataFont }}>
            SETTINGS
          </Text>
          <View style={{ overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: c.border }}>
            <SettingsRow
              title="Settings"
              detail="Account, privacy, and app preferences"
              onPress={() => router.push('/settings')}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
