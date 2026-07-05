import { supabase, isMockMode } from '../supabase.js'

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' })
  }

  const token = authHeader.replace('Bearer ', '')

  if (isMockMode) {
    // In mock mode, treat the token (email) as mock user info.
    // If token is empty or doesn't look like a value, default to a mock ID.
    const mockEmail = token && token !== 'undefined' ? token : 'mock@example.com'
    const cleanId = `mock-user-${Buffer.from(mockEmail).toString('hex').slice(0, 8)}`
    req.user = {
      id: cleanId,
      email: mockEmail,
      user_metadata: { full_name: mockEmail.split('@')[0] || 'Mock User' }
    }
    return next()
  }

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  req.user = user
  next()
}