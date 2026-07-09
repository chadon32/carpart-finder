import { accountsAvailable } from '../supabase.js'

// Exported as a factory so the behavior is unit-testable without touching env
// or the module cache.
export function makeAccountsGate(available) {
  return function requireAccountsAvailable(_req, res, next) {
    if (available) return next()
    // Deliberately generic: the client learns the feature is off, not why.
    // The operational detail is logged once at boot in supabase.js.
    return res.status(503).json({ error: 'Accounts are temporarily unavailable.' })
  }
}

export const requireAccountsAvailable = makeAccountsGate(accountsAvailable)
