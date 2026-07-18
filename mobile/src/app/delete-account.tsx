import { useRef, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ApiError } from '@/api/client'
import { accountDeletionErrorMessage, ACCOUNT_DELETION_CONFIRMATION, isAccountDeletionConfirmation } from '@/lib/accountDeletion'
import { useAuth } from '@/stores/auth'
import { useThemeColors, displayFont } from '@/theme'

export default function DeleteAccountScreen() {
  const c = useThemeColors()
  const deleteAccount = useAuth((s) => s.deleteAccount)
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const busyRef = useRef(false)

  const submit = async () => {
    if (busyRef.current) return
    if (!isAccountDeletionConfirmation(confirmation)) {
      setMessage(`Type ${ACCOUNT_DELETION_CONFIRMATION} exactly to confirm.`)
      return
    }

    busyRef.current = true
    setBusy(true)
    setMessage(null)
    try {
      await deleteAccount(confirmation)
      Alert.alert('Account deleted', 'Your account has been permanently deleted.')
      // Remove the account/settings screens from the navigation history so a
      // back gesture cannot reveal a stale account surface after deletion.
      router.dismissAll()
      router.replace('/(tabs)/garage')
    } catch (error) {
      // Keep the confirmation screen available for a safe retry. A stale
      // session is deliberately not treated as a successful deletion.
      setMessage(accountDeletionErrorMessage(error))
      if (error instanceof ApiError && error.status === 401) setConfirmation('')
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
          {['Profile', 'Saved addresses', 'Solar reports', 'Saved calculations', 'Preferences', 'Any other user-generated data'].map(
            (item) => (
              <Text key={item} style={{ color: c.text, fontSize: 16 }}>
                • {item}
              </Text>
            )
          )}
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
            onChangeText={setConfirmation}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!busy}
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

        {message ? <Text style={{ color: '#be123c', fontSize: 14, fontWeight: '600' }}>{message}</Text> : null}

        <View style={{ gap: 10, marginTop: 4 }}>
          <Pressable
            accessibilityRole="button"
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
            onPress={submit}
            disabled={busy}
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
