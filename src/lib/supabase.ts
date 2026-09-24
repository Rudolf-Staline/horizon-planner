import { createClient } from '@supabase/supabase-js'

const FALLBACK_SUPABASE_URL =
  'https://tmvsdzxwdizhfqkymbqm.supabase.co'

const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_f4T7E6B-Pe84Kb_kejcjPw_r2OMR1A9'

const url =
  import.meta.env.VITE_SUPABASE_URL?.trim() ||
  FALLBACK_SUPABASE_URL

const publishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  FALLBACK_SUPABASE_PUBLISHABLE_KEY

export const supabaseConfigured = Boolean(url && publishableKey)

export const supabase = supabaseConfigured
  ? createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
