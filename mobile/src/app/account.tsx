import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { SettingsRow } from '@/components/SettingsRow'
import { useAuth } from '@/stores/auth'
import { useThemeColors, dataFont, displayFont } from '@/theme'

export default function AccountScreen() {
  const c = useThemeColors()
  const user = useAuth((s) => s.user)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }}>
        <Text style={{ color: c.text, fontSize: 34, fontFamily: displayFont }}>ACCOUNT</Text>
        <View style={{ gap: 8 }}>
          <Text style={{ color: c.subtext, fontSize: 12, letterSpacing: 1, fontFamily: dataFont }}>
            SIGNED IN AS
          </Text>
          <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>
            {user?.email ?? user?.user_metadata?.full_name ?? 'your account'}
          </Text>
        </View>
        <View style={{ gap: 8 }}>
          <Text style={{ color: c.subtext, fontSize: 12, letterSpacing: 1, fontFamily: dataFont }}>
            ACCOUNT ACTIONS
          </Text>
          <View style={{ overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: c.border }}>
            <SettingsRow
              title="Delete Account"
              detail="Permanently remove your account and data"
              destructive
              onPress={() => router.push('/delete-account')}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
