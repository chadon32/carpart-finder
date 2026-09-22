import express from 'express'
import crypto from 'node:crypto'
import { supabase, supabaseAdmin, isMockMode } from '../supabase.js'
import { requireAuth, AUTH_COOKIE } from '../middleware/auth.js'
import { requireAccountsAvailable } from '../middleware/accountsAvailable.js'
import { deleteAccountPermanently, getAccountDeletionStatus } from '../lib/accountDeletion.js'
import {
  ACCOUNT_DELETION_RECEIPT_TTL_MS,
  createAccountDeletionReceipt,
  verifyAccountDeletionReceipt,
} from '../lib/accountDeletionReceipt.js'
import {
  ACCOUNT_LIMITS,
  isUuid,
  normalizeEmail,
  resolveOAuthRedirectOrigin,
  validateAccessToken,
  validateAuthInput,
  validateSavedSearchInput,
  validateTargetPrice,
} from '../lib/accountInputPolicy.js'

const router = express.Router()

const AUTH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000 // 7 days

// The auth token lives ONLY in an httpOnly cookie so page JavaScript (and thus
// any XSS) can never read it. secure is on in production (HTTPS); off locally
// so the cookie still works over http://localhost. sameSite=strict blocks it from
// cross-site POSTs and GETs, which mitigates CSRF for these state-changing routes.
function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: '/',
  })
}

function clearAuthCookie(res) {
  // Match the attributes used when setting it so browsers reliably delete it.
  res.clearCookie(AUTH_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  })
}

// In-memory mock database for local development without Supabase keys
const mockSavedSearches = []
const mockPriceAlerts = []
const mockDeletedUserIds = new Set()

// Defined BEFORE the gate on purpose. Logout takes no credentials and reads no
// database; it must keep working even when accounts are disabled, so browsers
// holding a stale cpf_token (issued by the old mock mode) can clear it.
router.post('/logout', (_req, res) => {
  clearAuthCookie(res)
  res.json({ success: true })
})

// Everything below requires that accounts can actually function. When Supabase
// is unconfigured this returns 503 rather than authenticating against nothing.
router.use(requireAccountsAvailable)

// Public endpoint for price alerts subscription (no-auth, guest conversion capture)
router.post('/price-alerts/subscribe', async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  if (!email) return res.status(400).json({ error: 'Enter a valid email address' })
  const searchInput = validateSavedSearchInput(req.body)
  if (searchInput.error) return res.status(400).json({ error: searchInput.error })
  const priceInput = validateTargetPrice(req.body?.target_price)
  if (priceInput.error) return res.status(400).json({ error: priceInput.error })
  const { year, make, model, trim, part } = searchInput.value
  const price = priceInput.value

  if (isMockMode) {
    console.log(`[Alert Subscription] Guest subscribed to ${year} ${make} ${model}${trim ? ` ${trim}` : ''} ${part} at target price $${price}`)
    return res.json({ success: true, message: 'Alert subscription created (Local Mock)!' })
  }

  const { data: activeAlerts, error: lookupError } = await supabaseAdmin
    .from('guest_alerts')
    .select('year,make,model,part')
    .eq('email', email)
    .eq('is_active', true)
    .limit(ACCOUNT_LIMITS.activeGuestAlertsPerEmail + 1)

  if (lookupError) {
    console.error('[Alert Subscription] Failed to check guest alert limit:', lookupError.message)
    return res.status(500).json({ error: 'Could not create alert subscription' })
  }

  const updatesExisting = (activeAlerts || []).some((alert) => (
    alert.year === year && alert.make === make && alert.model === model && alert.part === part
  ))
  if (!updatesExisting && activeAlerts.length >= ACCOUNT_LIMITS.activeGuestAlertsPerEmail) {
    return res.status(409).json({
      error: `You can have up to ${ACCOUNT_LIMITS.activeGuestAlertsPerEmail} active guest alerts.`,
    })
  }

  // Service-role client: guest_alerts has RLS with no anon policies on purpose.
  // Upsert so re-subscribing updates the target instead of erroring.
  const { error } = await supabaseAdmin
    .from('guest_alerts')
    .upsert(
      {
        email,
        year,
        make,
        model,
        trim: trim || null,
        part,
        target_price: price,
        is_active: true,
        triggered_at: null,
      },
      { onConflict: 'email,year,make,model,part' }
    )

  if (error) {
    console.error('[Alert Subscription] Failed to save guest alert:', error.message)
    if (error.code === '23514') {
      return res.status(409).json({ error: `You can have up to ${ACCOUNT_LIMITS.activeGuestAlertsPerEmail} active guest alerts.` })
    }
    return res.status(500).json({ error: 'Could not create alert subscription' })
  }
  res.json({ success: true, message: 'Alert subscription created!' })
})

// Sign up a new user profile
router.post('/signup', async (req, res) => {
  const input = validateAuthInput(req.body, { signup: true })
  if (input.error) return res.status(400).json({ error: input.error })
  const { email, password, name } = input.value

  if (isMockMode) {
    const cleanId = `mock-user-${Buffer.from(email).toString('hex').slice(0, 8)}`
    const newUser = {
      id: cleanId,
      email,
      user_metadata: { full_name: name || email.split('@')[0] || 'Mock User' }
    }
    setAuthCookie(res, email)
    return res.json({ user: newUser })
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name || email.split('@')[0]
      }
    }
  })

  if (error) {
    const message = String(error.message || '')
    if (/rate limit/i.test(message)) return res.status(429).json({ error: 'Too many signup emails were requested. Please wait and try again.' })
    if (/already registered|already exists/i.test(message)) return res.status(409).json({ error: 'An account already exists for this email.' })
    console.error('[supabase] signup failed:', message)
    return res.status(400).json({ error: 'Could not create the account. Check your information and try again.' })
  }

  // When the Supabase project requires email confirmation, signUp returns a
  // user but NO session, so there's no token. Signal that clearly instead of
  // handing back a tokenless "logged-in" state that 401s on every authed call.
  const token = data.session?.access_token || null
  if (token) setAuthCookie(res, token)
  res.json({
    user: data.user,
    confirmationRequired: !token,
  })
})

// Log in an existing user
router.post('/login', async (req, res) => {
  const input = validateAuthInput(req.body)
  if (input.error) return res.status(400).json({ error: input.error })
  const { email, password } = input.value

  if (isMockMode) {
    const cleanId = `mock-user-${Buffer.from(email).toString('hex').slice(0, 8)}`
    const user = {
      id: cleanId,
      email,
      user_metadata: { full_name: email.split('@')[0] || 'Mock User' }
    }
    setAuthCookie(res, email)
    return res.json({ user })
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    const message = String(error.message || '')
    if (/email.*not.*confirm/i.test(message)) {
      return res.status(403).json({ error: 'Confirm your email before signing in.' })
    }
    if (/rate limit|too many/i.test(message)) {
      return res.status(429).json({ error: 'Too many sign-in attempts. Please wait and try again.' })
    }
    return res.status(401).json({ error: 'Invalid email or password' })
  }
  const token = data.session?.access_token || null
  if (token) setAuthCookie(res, token)
  res.json({
    user: data.user,
    confirmationRequired: !token,
  })
})

// Start Google OAuth Flow
router.get('/oauth/google', async (_req, res) => {
  if (isMockMode) {
    return res.status(503).send('OAuth is not available in local mock mode.')
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // Redirect back to the frontend root. Supabase will append #access_token=...
      redirectTo: resolveOAuthRedirectOrigin()
    }
  })

  if (error) {
    console.error('[supabase] OAuth initialization failed:', error.message)
    return res.status(400).send('Could not start Google sign-in')
  }
  if (data?.url) return res.redirect(data.url)
  res.status(500).send('Failed to initialize OAuth flow')
})

// Receive an access_token from the frontend and securely set the HTTP-only cookie
router.post('/set-session', async (req, res) => {
  const { access_token } = req.body || {}
  if (!validateAccessToken(access_token)) return res.status(400).json({ error: 'Invalid token' })

  if (isMockMode) {
    return res.status(503).json({ error: 'OAuth not supported in mock mode' })
  }

  // Verify the token by asking Supabase who it belongs to
  const { data, error } = await supabase.auth.getUser(access_token)
  if (error || !data?.user) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  setAuthCookie(res, access_token)
  res.json({ user: data.user })
})

// Deletion is split into two calls. The authenticated intent call gives the
// client a short-lived signed receipt before the destructive request begins.
// If the final HTTP response is lost after Supabase deletes the Auth user, the
// client can use that receipt (without a now-invalid session) to confirm the
// final state instead of asking an already-deleted user to sign in again.
router.post('/account/deletion-intent', requireAuth, (req, res) => {
  if (req.body?.confirmation !== 'DELETE') {
    return res.status(400).json({ error: 'Type DELETE to confirm account deletion' })
  }

  const receipt = createAccountDeletionReceipt(req.user.id)
  if (!receipt) {
    console.error('[supabase] could not create an account deletion receipt')
    return res.status(503).json({ error: 'Account deletion is temporarily unavailable. Please try again.' })
  }

  return res.json({ receipt, expiresInMs: ACCOUNT_DELETION_RECEIPT_TTL_MS })
})

router.post('/account/deletion-status', async (req, res) => {
  const claims = verifyAccountDeletionReceipt(req.body?.receipt)
  if (!claims) {
    return res.status(400).json({ error: 'That deletion request expired. Start account deletion again.' })
  }

  if (isMockMode) {
    const deleted = mockDeletedUserIds.has(claims.userId)
    if (deleted) clearAuthCookie(res)
    return res.json({ success: true, deleted })
  }

  const result = await getAccountDeletionStatus({
    admin: supabaseAdmin,
    userId: claims.userId,
  })
  if (!result.success) {
    console.error('[supabase] account deletion status check failed:', result.error?.message)
    return res.status(502).json({ error: 'Could not confirm account deletion yet. Please try again.' })
  }

  if (result.deleted) clearAuthCookie(res)
  return res.json({ success: true, deleted: result.deleted })
})

// All routes below require authentication
router.use(requireAuth)

// Get current user (uses req.user set by requireAuth)
router.get('/me', async (req, res) => {
  res.json({ user: req.user })
})

// Permanently delete the authenticated account. The target user id is never
// accepted from the client: it always comes from requireAuth's verified JWT.
router.delete('/account', async (req, res) => {
  if (req.body?.confirmation !== 'DELETE') {
    return res.status(400).json({ error: 'Type DELETE to confirm account deletion' })
  }

  // Keep legacy clients working while requiring any supplied receipt to be
  // authentic, unexpired, and bound to this exact authenticated user.
  if (
    req.body?.receipt !== undefined
    && !verifyAccountDeletionReceipt(req.body.receipt, { expectedUserId: req.user.id })
  ) {
    return res.status(400).json({ error: 'That deletion request expired. Start account deletion again.' })
  }

  if (isMockMode) {
    for (let i = mockPriceAlerts.length - 1; i >= 0; i--) {
      if (mockPriceAlerts[i].user_id === req.user.id) mockPriceAlerts.splice(i, 1)
    }
    for (let i = mockSavedSearches.length - 1; i >= 0; i--) {
      if (mockSavedSearches[i].user_id === req.user.id) mockSavedSearches.splice(i, 1)
    }
    mockDeletedUserIds.add(req.user.id)
    clearAuthCookie(res)
    return res.json({ success: true })
  }

  const result = await deleteAccountPermanently({
    admin: supabaseAdmin,
    userId: req.user.id,
    email: req.user.email,
  })

  if (!result.success) {
    console.error(`[supabase] account deletion failed at ${result.stage} stage:`, result.error?.message)
    if (result.stage === 'auth') {
      return res.status(502).json({
        error: 'Your data was removed, but account closure could not be completed. Please try again.',
      })
    }
    return res.status(500).json({ error: 'Could not remove your account data. Please try again.' })
  }

  clearAuthCookie(res)
  return res.json({ success: true, alreadyDeleted: result.alreadyDeleted })
})

// Get user's saved searches
router.get('/saved-searches', async (req, res) => {
  const user = req.user
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (isMockMode) {
    const data = mockSavedSearches
      .filter((s) => s.user_id === user.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return res.json({ searches: data })
  }

  // supabaseAdmin everywhere below: the server validates the JWT in
  // requireAuth and scopes every query by user_id explicitly. The anon client
  // would be blocked by RLS since auth.uid() is unset server-side.
  const { data, error } = await supabaseAdmin
    .from('saved_searches')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Log the Postgres detail; never return it. Raw error.message leaks
  // constraint names, column names, and schema structure to the client.
  if (error) {
    console.error('[supabase] fetch saved searches failed:', error.message)
    return res.status(500).json({ error: 'Could not load your saved searches' })
  }
  res.json({ searches: data })
})

// Save a new search
router.post('/saved-searches', async (req, res) => {
  const input = validateSavedSearchInput(req.body)
  if (input.error) return res.status(400).json({ error: input.error })
  const { year, make, model, trim, part } = input.value

  if (isMockMode) {
    const existing = mockSavedSearches.find((search) => (
      search.user_id === req.user.id
      && search.year === year
      && search.make === make
      && search.model === model
      && (search.trim || null) === trim
      && search.part === part
    ))
    if (existing) return res.json({ search: existing, alreadyExists: true })
    const userSearchCount = mockSavedSearches.filter((search) => search.user_id === req.user.id).length
    if (userSearchCount >= ACCOUNT_LIMITS.savedSearchesPerUser) {
      return res.status(409).json({ error: `You can save up to ${ACCOUNT_LIMITS.savedSearchesPerUser} searches.` })
    }

    const newSearch = {
      id: crypto.randomUUID(),
      user_id: req.user.id,
      year,
      make,
      model,
      trim,
      part,
      created_at: new Date().toISOString()
    }
    mockSavedSearches.push(newSearch)
    return res.json({ search: newSearch })
  }

  let duplicateQuery = supabaseAdmin
    .from('saved_searches')
    .select('*')
    .eq('user_id', req.user.id)
    .eq('year', year)
    .eq('make', make)
    .eq('model', model)
    .eq('part', part)
  duplicateQuery = trim == null ? duplicateQuery.is('trim', null) : duplicateQuery.eq('trim', trim)
  const { data: existing, error: duplicateError } = await duplicateQuery.maybeSingle()
  if (duplicateError) {
    console.error('[supabase] duplicate saved-search check failed:', duplicateError.message)
    return res.status(500).json({ error: 'Could not save that search' })
  }
  if (existing) return res.json({ search: existing, alreadyExists: true })

  const { count, error: countError } = await supabaseAdmin
    .from('saved_searches')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', req.user.id)
  if (countError) {
    console.error('[supabase] saved-search limit check failed:', countError.message)
    return res.status(500).json({ error: 'Could not save that search' })
  }
  if ((count || 0) >= ACCOUNT_LIMITS.savedSearchesPerUser) {
    return res.status(409).json({ error: `You can save up to ${ACCOUNT_LIMITS.savedSearchesPerUser} searches.` })
  }

  const { data, error } = await supabaseAdmin
    .from('saved_searches')
    .insert({
      user_id: req.user.id,
      year,
      make,
      model,
      trim,
      part
    })
    .select()
    .single()

  if (error) {
    console.error('[supabase] insert saved search failed:', error.message)
    if (error.code === '23505') return res.status(409).json({ error: 'That search is already saved.' })
    if (error.code === '23514') {
      return res.status(409).json({ error: `You can save up to ${ACCOUNT_LIMITS.savedSearchesPerUser} searches.` })
    }
    return res.status(500).json({ error: 'Could not save that search' })
  }
  res.json({ search: data })
})

// Delete a saved search (cascades to its price alerts via FK)
router.delete('/saved-searches/:id', async (req, res) => {
  const { id } = req.params
  if (!isUuid(id)) return res.status(400).json({ error: 'Invalid saved search id' })

  if (isMockMode) {
    const idx = mockSavedSearches.findIndex((s) => s.id === id && s.user_id === req.user.id)
    if (idx === -1) return res.status(404).json({ error: 'Not found' })
    mockSavedSearches.splice(idx, 1)
    for (let i = mockPriceAlerts.length - 1; i >= 0; i--) {
      if (mockPriceAlerts[i].saved_search_id === id) mockPriceAlerts.splice(i, 1)
    }
    return res.json({ success: true })
  }

  const { error } = await supabaseAdmin
    .from('saved_searches')
    .delete()
    .eq('id', id)
    .eq('user_id', req.user.id)

  if (error) {
    console.error('[supabase] delete saved search failed:', error.message)
    return res.status(500).json({ error: 'Could not delete that search' })
  }
  res.json({ success: true })
})

// Delete a price alert
router.delete('/price-alerts/:id', async (req, res) => {
  const { id } = req.params
  if (!isUuid(id)) return res.status(400).json({ error: 'Invalid price alert id' })

  if (isMockMode) {
    const idx = mockPriceAlerts.findIndex((a) => a.id === id && a.user_id === req.user.id)
    if (idx === -1) return res.status(404).json({ error: 'Not found' })
    mockPriceAlerts.splice(idx, 1)
    return res.json({ success: true })
  }

  const { error } = await supabaseAdmin
    .from('price_alerts')
    .delete()
    .eq('id', id)
    .eq('user_id', req.user.id)

  if (error) {
    console.error('[supabase] delete price alert failed:', error.message)
    return res.status(500).json({ error: 'Could not delete that alert' })
  }
  res.json({ success: true })
})

// Get user's price alerts
router.get('/price-alerts', async (req, res) => {
  const user = req.user
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (isMockMode) {
    const data = mockPriceAlerts
      .filter((a) => a.user_id === user.id)
      .map((a) => ({
        ...a,
        saved_searches: mockSavedSearches.find((s) => s.id === a.saved_search_id) || null
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return res.json({ alerts: data })
  }

  const { data, error } = await supabaseAdmin
    .from('price_alerts')
    .select('*, saved_searches(*)')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[supabase] fetch price alerts failed:', error.message)
    return res.status(500).json({ error: 'Could not load your price alerts' })
  }
  res.json({ alerts: data })
})

// Create a price alert
router.post('/price-alerts', async (req, res) => {
  const { saved_search_id, target_price } = req.body || {}
  if (!isUuid(saved_search_id)) return res.status(400).json({ error: 'Invalid saved search id' })
  const priceInput = validateTargetPrice(target_price)
  if (priceInput.error) return res.status(400).json({ error: priceInput.error })
  const price = priceInput.value

  if (isMockMode) {
    const search = mockSavedSearches.find((s) => s.id === saved_search_id && s.user_id === req.user.id)
    if (!search) {
      return res.status(403).json({ error: 'Forbidden: search query does not belong to user or does not exist' })
    }

    const duplicate = mockPriceAlerts.find((alert) => (
      alert.user_id === req.user.id
      && alert.saved_search_id === saved_search_id
      && alert.is_active
    ))
    if (duplicate) return res.status(409).json({ error: 'An active alert already exists for this saved search.' })
    const activeCount = mockPriceAlerts.filter((alert) => alert.user_id === req.user.id && alert.is_active).length
    if (activeCount >= ACCOUNT_LIMITS.activePriceAlertsPerUser) {
      return res.status(409).json({ error: `You can have up to ${ACCOUNT_LIMITS.activePriceAlertsPerUser} active price alerts.` })
    }

    const newAlert = {
      id: crypto.randomUUID(),
      user_id: req.user.id,
      saved_search_id,
      target_price: price,
      is_active: true,
      last_checked_at: null,
      created_at: new Date().toISOString()
    }
    mockPriceAlerts.push(newAlert)
    return res.json({ alert: newAlert })
  }

  // Verify that the saved search belongs to this user before allowing alert creation
  const { data: searchCheck, error: searchCheckError } = await supabaseAdmin
    .from('saved_searches')
    .select('id')
    .eq('id', saved_search_id)
    .eq('user_id', req.user.id)
    .single()

  if (searchCheckError || !searchCheck) {
    return res.status(403).json({ error: 'Forbidden: search query does not belong to user or does not exist' })
  }

  const { data: activeAlerts, error: activeAlertsError } = await supabaseAdmin
    .from('price_alerts')
    .select('id,saved_search_id')
    .eq('user_id', req.user.id)
    .eq('is_active', true)
    .limit(ACCOUNT_LIMITS.activePriceAlertsPerUser + 1)

  if (activeAlertsError) {
    console.error('[supabase] price-alert limit check failed:', activeAlertsError.message)
    return res.status(500).json({ error: 'Could not create that alert' })
  }
  if (activeAlerts.some((alert) => alert.saved_search_id === saved_search_id)) {
    return res.status(409).json({ error: 'An active alert already exists for this saved search.' })
  }
  if (activeAlerts.length >= ACCOUNT_LIMITS.activePriceAlertsPerUser) {
    return res.status(409).json({ error: `You can have up to ${ACCOUNT_LIMITS.activePriceAlertsPerUser} active price alerts.` })
  }

  const { data, error } = await supabaseAdmin
    .from('price_alerts')
    .insert({
      user_id: req.user.id,
      saved_search_id,
      target_price: price
    })
    .select()
    .single()

  if (error) {
    console.error('[supabase] insert price alert failed:', error.message)
    if (error.code === '23505') return res.status(409).json({ error: 'An active alert already exists for this saved search.' })
    if (error.code === '23514') {
      return res.status(409).json({ error: `You can have up to ${ACCOUNT_LIMITS.activePriceAlertsPerUser} active price alerts.` })
    }
    if (error.code === '42501') return res.status(403).json({ error: 'That saved search is not available to this account.' })
    return res.status(500).json({ error: 'Could not create that alert' })
  }
  res.json({ alert: data })
})

export default router
