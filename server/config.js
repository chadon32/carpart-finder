// Pure resolver: environment -> auth-config verdict. No side effects, no
// network, no Supabase import — so the security-critical decision below is
// exhaustively unit-testable (see config.test.js).
//
// The bug this exists to kill: mock mode used to be *inferred* from missing
// configuration, so a single absent env var in production silently turned the
// auth system into a no-op that accepted any password for any email. Mock mode
// is now an explicit, development-only opt-in. Missing config fails CLOSED.

function isValidHttpUrl(value) {
  if (!value) return false
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function resolveAuthConfig(env = process.env) {
  const url = env.SUPABASE_URL?.trim()
  const anonKey = env.SUPABASE_ANON_KEY?.trim()
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const isProduction = env.NODE_ENV === 'production'

  const hasValidConfig = isValidHttpUrl(url) && Boolean(anonKey)
  const hasServiceRole = Boolean(serviceKey)

  // Mock mode requires ALL THREE: no real config, not production, and an
  // explicit opt-in. Production can never reach it, whatever the env says.
  const isMockMode = !hasValidConfig && !isProduction && env.ALLOW_MOCK_AUTH === '1'

  // Every authenticated write path uses the service-role client, so a missing
  // service key means accounts cannot actually function — report unavailable
  // rather than silently degrading to the anon client (which RLS then blocks).
  const accountsAvailable = (hasValidConfig && hasServiceRole) || isMockMode

  let reason = ''
  if (accountsAvailable) {
    reason = isMockMode ? 'mock mode (development opt-in)' : 'supabase configured'
  } else if (!hasValidConfig) {
    reason =
      `Supabase is not configured (url=${url ? 'set' : 'missing'}, ` +
      `anonKey=${anonKey ? 'set' : 'missing'}). Account features are disabled.`
  } else {
    reason = 'SUPABASE_SERVICE_ROLE_KEY is missing. Account features are disabled.'
  }

  return { hasValidConfig, hasServiceRole, isMockMode, accountsAvailable, reason }
}
