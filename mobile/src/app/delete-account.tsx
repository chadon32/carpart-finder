import { useRef, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ApiError } from '@/api/client'
import {
  accountDeletionErrorMessage,
  ACCOUNT_DELETION_CONFIRMATION,
  ACCOUNT_DELETION_DATA_ITEMS,
  isAccountDeletedLocalCleanupError,
  isAccountDeletionConfirmation,
} from '@/lib/accountDeletion'
import { useAuth } from '@/stores/auth'
import { useThemeColors, displayFont } from '@/theme'

export default function DeleteAccountScreen() {
  const c = useThemeColors()
  const deleteAccount = useAuth((s) => s.deleteAccount)
  const authStatus = useAuth((s) => s.status)
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [reauthRequired, setReauthRequired] = useState(false)
  const busyRef = useRef(false)
  const authenticationRequired = reauthRequired || authStatus === 'signedOut'

  const submit = async () => {
    if (busyRef.current) return
    if (authStatus !== 'signedIn') {
      setReauthRequired(true)
      setMessage('Sign in again before retrying account deletion.')
      return
    }
    if (!isAccountDeletionConfirmation(confirmation)) {
      setMessage(`Type ${ACCOUNT_DELETION_CONFIRMATION} exactly to confirm.`)
      return
    }

    busyRef.current = true
    setBusy(true)
    setMessage(null)
    try {
      await deleteAccount(confirmation)
      // Remove the account/settings screens from the navigation history so a
      // back gesture cannot reveal a stale account surface after deletion.
      router.dismissAll()
      router.replace({ pathname: '/account', params: { outcome: 'deleted' } })
    } catch (error) {
      // Keep the confirmation screen available for a safe retry. A stale
      // session is deliberately not treated as a successful deletion.
      if (isAccountDeletedLocalCleanupError(error)) {
        router.dismissAll()
        router.replace({
          pathname: '/account',
          params: { outcome: 'deleted', cleanup: 'failed' },
        })
        return
      }
      setMessage(accountDeletionErrorMessage(error))
      if (error instanceof ApiError && error.status === 401) {
        setConfirmation('')
        setReauthRequired(true)
      }
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: c.text, fontSize: 34, fontFamily: displayFont }}>DELETE ACCOUNT</Text>
        <View style={{ gap: 10 }}>
          <Text style={{ color: c.text, fontSize: 17, fontWeight: '700' }}>
            Deleting your account will permanently remove:
          </Text>
          {ACCOUNT_DELETION_DATA_ITEMS.map((item) => (
              <Text key={item} style={{ color: c.text, fontSize: 16 }}>
                • {item}
              </Text>
            ))}
          <Text style={{ color: '#be123c', fontSize: 16, fontWeight: '700', marginTop: 4 }}>
            This action cannot be undone.
          </Text>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ color: c.subtext, fontSize: 13 }}>
            To continue, type DELETE below.
          </Text>
          <TextInput
            value={confirmation}
            onChangeText={(value) => {
              setConfirmation(value)
              setMessage(null)
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!busy && !authenticationRequired && authStatus !== 'unknown'}
            placeholder="DELETE"
            placeholderTextColor={c.subtext}
            accessibilityLabel="Type DELETE to confirm"
            style={{
              minHeight: 48,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.card,
              color: c.text,
              paddingHorizontal: 14,
              fontSize: 17,
              letterSpacing: 1,
            }}
          />
        </View>

        {message ? (
          <Text accessibilityRole="alert" style={{ color: '#be123c', fontSize: 14, fontWeight: '600' }}>
            {message}
          </Text>
        ) : null}

        {authStatus === 'unknown' ? (
          <Text accessible accessibilityLabel="Checking account session" style={{ color: c.subtext, fontSize: 14 }}>
            Checking your account session...
          </Text>
        ) : null}

        {authenticationRequired ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace({ pathname: '/account', params: { action: 'reauth-delete' } })}
            style={{
              minHeight: 48,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: c.brand,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Sign in again</Text>
          </Pressable>
        ) : null}

        <View style={{ gap: 10, marginTop: 4 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            onPress={() => router.back()}
            disabled={busy}
            style={{
              minHeight: 48,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: c.border,
              opacity: busy ? 0.5 : 1,
            }}
          >
            <Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }}>Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy, disabled: busy || authenticationRequired || authStatus === 'unknown' }}
            onPress={submit}
            disabled={busy || authenticationRequired || authStatus === 'unknown'}
            style={{
              minHeight: 50,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: busy ? c.border : '#be123c',
            }}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Delete My Account</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
