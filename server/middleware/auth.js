import { supabase, isMockMode } from '../supabase.js'

export const AUTH_COOKIE = 'cpf_token'

// Prefer the httpOnly auth cookie (JS-unreadable, so safe from XSS token
// theft). Fall back to the Authorization header for any client that hasn't
// migrated yet. Returns the raw token string, or null.
export function getAuthToken(req) {
  const rawCookie = req.headers.cookie || ''
  const match = rawCookie.match(/(?:^|;\s*)cpf_token=([^;]+)/)
  if (match) {
    try {
      return decodeURIComponent(match[1])
    } catch {
      return null // malformed percent-encoding
    }
  }

  // Anchored and case-insensitive. The old `.replace('Bearer ', '')` accepted a
  // bare token with no scheme, passed a `Basic ...` header straight through,
  // and stripped only the first occurrence of the literal anywhere in the
  // string.
  const authHeader = req.headers.authorization
  const bearer = authHeader?.match(/^Bearer\s+(.+)$/i)
  return bearer ? bearer[1].trim() : null
}

export async function requireAuth(req, res, next) {
  const token = getAuthToken(req)

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

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