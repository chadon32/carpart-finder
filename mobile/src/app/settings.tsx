import { Linking, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { SettingsRow } from '@/components/SettingsRow'
import { useThemeColors, dataFont, displayFont } from '@/theme'
import { PRIVACY_POLICY_URL } from '@/lib/legal'

export default function SettingsScreen() {
  const c = useThemeColors()

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }}>
        <Text style={{ color: c.text, fontSize: 34, fontFamily: displayFont }}>SETTINGS</Text>
        <View style={{ gap: 8 }}>
          <Text style={{ color: c.subtext, fontSize: 12, letterSpacing: 1, fontFamily: dataFont }}>
            ACCOUNT
          </Text>
          <View style={{ overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: c.border }}>
            <SettingsRow
              title="Account"
              detail="Manage your account and data"
              onPress={() => router.push('/account')}
            />
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <Text style={{ color: c.subtext, fontSize: 12, letterSpacing: 1, fontFamily: dataFont }}>
            PRIVACY
          </Text>
          <View style={{ overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: c.border }}>
            <SettingsRow
              title="Privacy Policy"
              detail="How CarPartsRadar collects and deletes data"
              onPress={() => void Linking.openURL(PRIVACY_POLICY_URL).catch(() => undefined)}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
