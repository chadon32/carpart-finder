import { useCallback, useRef, useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator, Linking } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useAuth } from '../stores/auth'
import { getPriceAlerts, deleteSavedSearch, type PriceAlert } from '../api/client'
import { useThemeColors, brand, dataFont } from '../theme'
import { PRIVACY_POLICY_URL } from '../lib/legal'

// Sign in / sign up / signed-in summary with the user's price alerts.
// Accounts are shared with carpartsradar.com — same email works both places.
type AccountCardProps = {
  signedOutMessage?: string
  onAuthenticated?: () => void
  initialEmail?: string
  requiredEmail?: string
  allowSignup?: boolean
}

export function AccountCard({
  signedOutMessage,
  onAuthenticated,
  initialEmail = '',
  requiredEmail,
  allowSignup = true,
}: AccountCardProps = {}) {
  const c = useThemeColors()
  const { user, status, login, signup, logout } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; kind: 'info' | 'error' } | null>(null)
  const [alerts, setAlerts] = useState<PriceAlert[] | null>(null)
  const passwordInput = useRef<TextInput>(null)

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
    // Explicit validation messages — a silently disabled button reads as
    // "nothing happens".
    if (!email.trim()) {
      setMsg({ text: 'Enter your email address.', kind: 'error' })
      return
    }
    if (requiredEmail && email.trim().toLowerCase() !== requiredEmail.trim().toLowerCase()) {
      setMsg({ text: `Sign in with ${requiredEmail} to continue account deletion.`, kind: 'error' })
      return
    }
    if (password.length < 8) {
      setMsg({ text: 'Password must be at least 8 characters.', kind: 'error' })
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const r = await (mode === 'login' ? login(email.trim(), password) : signup(email.trim(), password))
      if (r.confirmationRequired) {
        setMsg({
          text: '✓ Account created — check your email for the confirmation link, then log in here.',
          kind: 'info',
        })
        setMode('login')
        setPassword('')
      } else {
        onAuthenticated?.()
      }
    } catch (e) {
      setMsg({
        text: e instanceof Error ? e.message : 'Something went wrong — try again.',
        kind: 'error',
      })
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
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove price alert for ${a.saved_searches?.part ?? 'saved search'}`}
                    onPress={() => removeAlert(a)}
                    hitSlop={6}
                    style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: '#be123c', fontWeight: '700' }}>Remove</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/profile')}
            style={{
              minHeight: 44,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            <Text style={{ color: c.text, fontWeight: '700' }}>Profile & Settings</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
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
          {signedOutMessage ? (
            <Text accessibilityRole="alert" style={{ color: c.text, fontSize: 14, lineHeight: 20 }}>
              {signedOutMessage}
            </Text>
          ) : null}
          <View style={{ gap: 6 }}>
            <Text style={{ color: c.text, fontSize: 14, fontWeight: '600' }}>Email address</Text>
            <TextInput
              accessibilityLabel="Email address"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={c.subtext}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              keyboardType="email-address"
              returnKeyType="next"
              onSubmitEditing={() => passwordInput.current?.focus()}
              style={field}
            />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={{ color: c.text, fontSize: 14, fontWeight: '600' }}>Password</Text>
            <TextInput
              ref={passwordInput}
              accessibilityLabel="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="8 or more characters"
              placeholderTextColor={c.subtext}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              textContentType={mode === 'login' ? 'password' : 'newPassword'}
              secureTextEntry
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
              style={field}
            />
          </View>
          {msg ? (
            <Text accessibilityRole="alert" style={{ color: msg.kind === 'error' ? '#be123c' : '#047857', fontSize: 13, fontWeight: '600' }}>
              {msg.text}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy, disabled: busy }}
            onPress={submit}
            disabled={busy}
            style={{
              minHeight: 48,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: busy ? c.border : brand,
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
          {allowSignup ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setMode((m) => (m === 'login' ? 'signup' : 'login'))
                setMsg(null)
                setPassword('')
              }}
              hitSlop={8}
              style={{ alignItems: 'center', minHeight: 44, justifyContent: 'center' }}
            >
              <Text style={{ color: brand, fontWeight: '600' }}>
                {mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}
              </Text>
            </Pressable>
          ) : null}
          <Text style={{ color: c.subtext, fontSize: 12 }}>
            One account for the app and carpartsradar.com.
          </Text>
        </>
      )}
      <Pressable
        accessibilityRole="link"
        onPress={() => void Linking.openURL(PRIVACY_POLICY_URL).catch(() => undefined)}
        hitSlop={8}
        style={{ alignItems: 'center', minHeight: 44, justifyContent: 'center' }}
      >
        <Text style={{ color: brand, fontWeight: '600' }}>Privacy Policy</Text>
      </Pressable>
    </View>
  )
}
