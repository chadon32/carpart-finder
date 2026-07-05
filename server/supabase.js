import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

// A malformed or half-configured Supabase env (bad URL, empty key, only one of
// URL/key set) makes createClient() throw at import time. Because this module
// is imported by the single Vercel serverless function, that throw would take
// down the ENTIRE API — including the vehicle/search endpoints that never touch
// Supabase. So we validate first and fall back to mock mode instead of letting
// the whole function crash with FUNCTION_INVOCATION_FAILED.
const rawUrl = process.env.SUPABASE_URL?.trim()
const rawAnonKey = process.env.SUPABASE_ANON_KEY?.trim()
const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

function isValidHttpUrl(value) {
  if (!value) return false
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

const hasValidConfig = isValidHttpUrl(rawUrl) && Boolean(rawAnonKey)

export const isMockMode = !hasValidConfig

if (isMockMode) {
  if (rawUrl || rawAnonKey || rawServiceKey) {
    // Something was set but it's incomplete/malformed — warn loudly so a
    // misconfigured deploy is obvious in the logs rather than silently mock.
    console.warn(
      '⚠️ Supabase config is incomplete or invalid ' +
        `(url=${rawUrl ? 'set' : 'missing'}, anonKey=${rawAnonKey ? 'set' : 'missing'}). ` +
        'Falling back to LOCAL MOCK MODE — accounts, saved searches, and alerts will not persist.'
    )
  } else {
    console.warn('⚠️ SUPABASE_URL / SUPABASE_ANON_KEY not set. Supabase features run in LOCAL MOCK MODE.')
  }
}

// Safe placeholders when unconfigured — createClient needs syntactically valid
// args, but in mock mode nothing actually calls out to them.
const supabaseUrl = hasValidConfig ? rawUrl : 'https://mock.supabase.co'
const supabaseAnonKey = hasValidConfig ? rawAnonKey : 'dummy-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Service-role client for server-side writes that must bypass RLS. Falls back
// to the anon client when the service key is missing or config is mocked.
export const supabaseAdmin =
  hasValidConfig && rawServiceKey ? createClient(supabaseUrl, rawServiceKey) : supabase
