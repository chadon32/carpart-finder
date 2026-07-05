import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.SUPABASE_URL || 'https://mock.supabase.co'
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'dummy-anon-key'

export const isMockMode = !process.env.SUPABASE_ANON_KEY || !process.env.SUPABASE_URL

if (isMockMode) {
  console.warn('⚠️ SUPABASE_ANON_KEY is not set in environment variables. Supabase features will run in LOCAL MOCK MODE.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : supabase