import express from 'express'
import crypto from 'node:crypto'
import { supabase, supabaseAdmin, isMockMode } from '../supabase.js'
import { requireAuth, AUTH_COOKIE } from '../middleware/auth.js'

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
const mockGuestSubscriptions = []

// Public endpoint for price alerts subscription (no-auth, guest conversion capture)
router.post('/price-alerts/subscribe', async (req, res) => {
  const { email, year, make, model, trim, part, target_price } = req.body

  if (!email || !year || !make || !model || !part || !target_price) {
    return res.status(400).json({ error: 'Missing required fields' })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
    return res.status(400).json({ error: 'Invalid email address' })
  }
  const price = Number(target_price)
  if (!Number.isFinite(price) || price <= 0) {
    return res.status(400).json({ error: 'Invalid target price' })
  }

  if (isMockMode) {
    console.log(`[Alert Subscription] Guest ${email} subscribed to alerts for ${year} ${make} ${model}${trim ? ` ${trim}` : ''} ${part} at target price $${price}`)
    mockGuestSubscriptions.push({
      id: crypto.randomUUID(),
      email,
      year,
      make,
      model,
      trim,
      part,
      target_price: price,
      created_at: new Date().toISOString()
    })
    return res.json({ success: true, message: 'Alert subscription created (Local Mock)!' })
  }

  // Service-role client: guest_alerts has RLS with no anon policies on purpose.
  // Upsert so re-subscribing updates the target instead of erroring.
  const { error } = await supabaseAdmin
    .from('guest_alerts')
    .upsert(
      {
        email: String(email).toLowerCase(),
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
    return res.status(500).json({ error: 'Could not create alert subscription' })
  }
  res.json({ success: true, message: 'Alert subscription created!' })
})

// Sign up a new user profile
router.post('/signup', async (req, res) => {
  const { email, password, name } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

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

  if (error) return res.status(400).json({ error: error.message })

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
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

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

  if (error) return res.status(400).json({ error: error.message })
  const token = data.session?.access_token || null
  if (token) setAuthCookie(res, token)
  res.json({
    user: data.user,
    confirmationRequired: !token,
  })
})

// Clear the auth cookie. Public (no requireAuth) so an expired session can
// still log out cleanly.
router.post('/logout', (_req, res) => {
  clearAuthCookie(res)
  res.json({ success: true })
})

// All routes below require authentication
router.use(requireAuth)

// Get current user (uses req.user set by requireAuth)
router.get('/me', async (req, res) => {
  res.json({ user: req.user })
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

  if (error) return res.status(500).json({ error: error.message })
  res.json({ searches: data })
})

// Save a new search
router.post('/saved-searches', async (req, res) => {
  const { year, make, model, trim, part } = req.body

  if (isMockMode) {
    const newSearch = {
      id: crypto.randomUUID(),
      user_id: req.user.id,
      year,
      make,
      model,
      trim: trim || null,
      part,
      created_at: new Date().toISOString()
    }
    mockSavedSearches.push(newSearch)
    return res.json({ search: newSearch })
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

  if (error) return res.status(500).json({ error: error.message })
  res.json({ search: data })
})

// Delete a saved search (cascades to its price alerts via FK)
router.delete('/saved-searches/:id', async (req, res) => {
  const { id } = req.params

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

  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

// Delete a price alert
router.delete('/price-alerts/:id', async (req, res) => {
  const { id } = req.params

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

  if (error) return res.status(500).json({ error: error.message })
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

  if (error) return res.status(500).json({ error: error.message })
  res.json({ alerts: data })
})

// Create a price alert
router.post('/price-alerts', async (req, res) => {
  const { saved_search_id, target_price } = req.body

  if (isMockMode) {
    const search = mockSavedSearches.find((s) => s.id === saved_search_id && s.user_id === req.user.id)
    if (!search) {
      return res.status(403).json({ error: 'Forbidden: search query does not belong to user or does not exist' })
    }

    const newAlert = {
      id: crypto.randomUUID(),
      user_id: req.user.id,
      saved_search_id,
      target_price: Number(target_price),
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

  const { data, error } = await supabaseAdmin
    .from('price_alerts')
    .insert({
      user_id: req.user.id,
      saved_search_id,
      target_price
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json({ alert: data })
})

export default router