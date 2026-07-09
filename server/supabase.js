import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'
import { resolveAuthConfig } from './config.js'

// A malformed or half-configured Supabase env used to silently enable mock
// mode. It no longer can: resolveAuthConfig fails closed in production. This
// module still must not throw at import time, because it is imported by the
// single Vercel serverless function — a throw here would take down the search
// endpoints too, which need no database at all.
const config = resolveAuthConfig(process.env)

export const isMockMode = config.isMockMode
export const accountsAvailable = config.accountsAvailable

if (!accountsAvailable) {
  // An error, not a warning: in production this means the login form is dark.
  console.error(`[auth] ACCOUNTS DISABLED — ${config.reason}`)
} else if (isMockMode) {
  console.warn('⚠️ [auth] LOCAL MOCK MODE — accounts do not persist and passwords are not verified.')
}

// createClient needs syntactically valid args even when unused.
const supabaseUrl = config.hasValidConfig ? process.env.SUPABASE_URL.trim() : 'https://mock.supabase.co'
const supabaseAnonKey = config.hasValidConfig ? process.env.SUPABASE_ANON_KEY.trim() : 'dummy-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Service-role client for server-side writes that bypass RLS. It is `null`
// when unusable — NEVER the anon client. The old fallback made every
// guest-alert insert fail silently against RLS and made authed reads return
// empty sets, because auth.uid() is null server-side. Callers are only
// reachable when accountsAvailable is true (see requireAccountsAvailable),
// and the mock branches never touch this client.
export const supabaseAdmin =
  config.hasValidConfig && config.hasServiceRole
    ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY.trim())
    : null
