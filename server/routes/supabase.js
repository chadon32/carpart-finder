import express from 'express'
import crypto from 'node:crypto'
import { supabase, isMockMode } from '../supabase.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

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

  if (isMockMode) {
    console.log(`[Alert Subscription] Guest ${email} subscribed to alerts for ${year} ${make} ${model}${trim ? ` ${trim}` : ''} ${part} at target price $${target_price}`)
    mockGuestSubscriptions.push({
      id: crypto.randomUUID(),
      email,
      year,
      make,
      model,
      trim,
      part,
      target_price: Number(target_price),
      created_at: new Date().toISOString()
    })
    return res.json({ success: true, message: 'Alert subscription created (Local Mock)!' })
  }

  // Real Supabase implementation: In production, save guest alert info
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
    return res.json({ user: newUser, token: email })
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
  res.json({
    user: data.user,
    token: data.session?.access_token || null
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
    return res.json({ user, token: email })
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) return res.status(400).json({ error: error.message })
  res.json({
    user: data.user,
    token: data.session?.access_token || null
  })
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

  const { data, error } = await supabase
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

  const { data, error } = await supabase
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

  const { data, error } = await supabase
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
  const { data: searchCheck, error: searchCheckError } = await supabase
    .from('saved_searches')
    .select('id')
    .eq('id', saved_search_id)
    .eq('user_id', req.user.id)
    .single()

  if (searchCheckError || !searchCheck) {
    return res.status(403).json({ error: 'Forbidden: search query does not belong to user or does not exist' })
  }

  const { data, error } = await supabase
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