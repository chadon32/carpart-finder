import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { AccountCard } from '@/components/AccountCard'
import { SettingsRow } from '@/components/SettingsRow'
import { useAuth } from '@/stores/auth'
import { useThemeColors, dataFont, displayFont } from '@/theme'

export default function AccountScreen() {
  const c = useThemeColors()
  const user = useAuth((s) => s.user)
  const status = useAuth((s) => s.status)
  const reauthEmail = useAuth((s) => s.reauthEmail)
  const { outcome, action, cleanup } = useLocalSearchParams<{
    outcome?: string
    action?: string
    cleanup?: string
  }>()
  const reauthenticatingForDeletion = action === 'reauth-delete'

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }}>
        <Text style={{ color: c.text, fontSize: 34, fontFamily: displayFont }}>ACCOUNT</Text>
        {outcome === 'deleted' ? (
          <View
            accessibilityRole="alert"
            style={{ borderRadius: 14, borderWidth: 1, borderColor: '#86efac', backgroundColor: '#f0fdf4', padding: 14, gap: 4 }}
          >
            <Text style={{ color: '#166534', fontSize: 16, fontWeight: '800' }}>Account permanently deleted</Text>
            <Text style={{ color: '#166534', fontSize: 14, lineHeight: 20 }}>
              Your account has been permanently deleted. You are signed out and may create a new account at any time.
            </Text>
          </View>
        ) : null}
        {outcome === 'deleted' && cleanup === 'failed' ? (
          <View
            accessibilityRole="alert"
            style={{ borderRadius: 14, borderWidth: 1, borderColor: '#fbbf24', backgroundColor: '#fffbeb', padding: 14, gap: 4 }}
          >
            <Text style={{ color: '#92400e', fontSize: 16, fontWeight: '800' }}>Device cleanup needs attention</Text>
            <Text style={{ color: '#92400e', fontSize: 14, lineHeight: 20 }}>
              Your online account is deleted, but some cached data could not be removed from this device. For privacy, remove and reinstall the app before signing in again.
            </Text>
          </View>
        ) : null}

        {status === 'unknown' ? (
          <View accessible accessibilityLabel="Checking account status" style={{ alignItems: 'center', paddingVertical: 32, gap: 10 }}>
            <ActivityIndicator color={c.brand} />
            <Text style={{ color: c.subtext }}>Checking account status...</Text>
          </View>
        ) : status !== 'signedIn' || !user ? (
          <AccountCard
            signedOutMessage={
              reauthenticatingForDeletion
                ? 'Your session expired. Sign in again to return to account deletion.'
                : 'Sign in to manage your account and data.'
            }
            onAuthenticated={
              reauthenticatingForDeletion ? () => router.replace('/delete-account') : undefined
            }
            initialEmail={reauthenticatingForDeletion ? reauthEmail ?? '' : ''}
            requiredEmail={reauthenticatingForDeletion ? reauthEmail ?? undefined : undefined}
            allowSignup={!reauthenticatingForDeletion}
          />
        ) : (
          <>
            <View style={{ gap: 8 }}>
              <Text style={{ color: c.subtext, fontSize: 12, letterSpacing: 1, fontFamily: dataFont }}>
                SIGNED IN AS
              </Text>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>
                {user.email ?? user.user_metadata?.full_name ?? 'your account'}
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
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
