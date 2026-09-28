import { createClient } from '@supabase/supabase-js'

let plannerResetEpoch = 0

export function setPlannerResetEpoch(value: number) {
  plannerResetEpoch = Number.isFinite(value) ? value : 0
}

function fetchWithPlannerEpoch(input: RequestInfo | URL, init?: RequestInit) {
  const requestUrl = typeof input === 'string'
    ? input
    : input instanceof URL ? input.href : input.url
  if (!plannerResetEpoch || !requestUrl.includes('/rest/v1/')) {
    return fetch(input, init)
  }

  const headers = new Headers(input instanceof Request ? input.headers : undefined)
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value))
  headers.set('x-horizon-reset-epoch', String(plannerResetEpoch))
  return fetch(input, { ...init, headers })
}

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
      global: { fetch: fetchWithPlannerEpoch },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
