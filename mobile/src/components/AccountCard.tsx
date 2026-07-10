import { useCallback, useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useAuth } from '../stores/auth'
import { getPriceAlerts, deleteSavedSearch, type PriceAlert } from '../api/client'
import { useThemeColors, brand, dataFont } from '../theme'

// Sign in / sign up / signed-in summary with the user's price alerts.
// Accounts are shared with carpartsradar.com — same email works both places.
export function AccountCard() {
  const c = useThemeColors()
  const { user, status, login, signup, logout } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<PriceAlert[] | null>(null)

  // Refetch on every focus of the Garage tab so alerts created from a
  // listing (while this card stayed mounted) show up immediately.
  useFocusEffect(
    useCallback(() => {
      if (status !== 'signedIn') {
        setAlerts(null)
        return
      }
      getPriceAlerts()
        .then((r) => setAlerts(r.alerts))
        .catch(() => setAlerts(null))
    }, [status])
  )

  const submit = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const r = await (mode === 'login' ? login(email.trim(), password) : signup(email.trim(), password))
      if (r.confirmationRequired) {
        setMsg('Check your email to confirm your account, then log in here.')
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Something went wrong — try again.')
    } finally {
      setBusy(false)
    }
  }

  const removeAlert = async (a: PriceAlert) => {
    if (!a.saved_searches) return
    try {
      await deleteSavedSearch(a.saved_searches.id)
      setAlerts((cur) => cur?.filter((x) => x.id !== a.id) ?? null)
    } catch {
      // Leave the row; the next refresh reflects reality.
    }
  }

  const field = {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    color: c.text,
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.border,
  } as const

  return (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.border,
        padding: 14,
        gap: 10,
      }}
    >
      <Text style={{ color: c.subtext, fontSize: 12, letterSpacing: 1, fontFamily: dataFont }}>
        ACCOUNT
      </Text>

      {status === 'unknown' ? (
        <ActivityIndicator />
      ) : status === 'signedIn' && user ? (
        <>
          <Text style={{ color: c.text, fontWeight: '600' }}>
            Signed in as {user.email ?? user.user_metadata?.full_name ?? 'you'}
          </Text>
          <Text style={{ color: c.subtext, fontSize: 12 }}>
            Same account as carpartsradar.com — price alerts email you when a part drops below
            your target.
          </Text>
          {alerts && alerts.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={{ color: c.subtext, fontSize: 12, letterSpacing: 1, fontFamily: dataFont }}>
                PRICE ALERTS
              </Text>
              {alerts.map((a) => (
                <View
                  key={a.id}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontWeight: '600' }} numberOfLines={1}>
                      {a.saved_searches
                        ? `${a.saved_searches.part} · ${a.saved_searches.year} ${a.saved_searches.make} ${a.saved_searches.model}`
                        : 'Alert'}
                    </Text>
                    <Text style={{ color: c.subtext, fontSize: 12 }}>
                      Alert below ${Number(a.target_price).toFixed(2)}
                    </Text>
                  </View>
                  <Pressable onPress={() => removeAlert(a)} hitSlop={10}>
                    <Text style={{ color: '#be123c', fontWeight: '700' }}>Remove</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          <Pressable
            onPress={logout}
            style={{
              minHeight: 44,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            <Text style={{ color: c.text, fontWeight: '700' }}>Log out</Text>
          </Pressable>
        </>
      ) : (
        <>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={c.subtext}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={field}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password (8+ characters)"
            placeholderTextColor={c.subtext}
            secureTextEntry
            style={field}
          />
          {msg ? <Text style={{ color: '#be123c', fontSize: 13 }}>{msg}</Text> : null}
          <Pressable
            onPress={submit}
            disabled={busy || !email.trim() || password.length < 8}
            style={{
              minHeight: 48,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: !busy && email.trim() && password.length >= 8 ? brand : c.border,
            }}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '700' }}>
                {mode === 'login' ? 'Log in' : 'Create account'}
              </Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => {
              setMode((m) => (m === 'login' ? 'signup' : 'login'))
              setMsg(null)
            }}
            hitSlop={8}
            style={{ alignItems: 'center', minHeight: 32, justifyContent: 'center' }}
          >
            <Text style={{ color: brand, fontWeight: '600' }}>
              {mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}
            </Text>
          </Pressable>
          <Text style={{ color: c.subtext, fontSize: 12 }}>
            One account for the app and carpartsradar.com.
          </Text>
        </>
      )}
    </View>
  )
}
