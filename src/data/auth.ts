import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export async function currentCloudUser(): Promise<User | null> {
  if (!supabase) return null

  const { data, error } = await supabase.auth.getUser()
  if (error) {
    const message = error.message.toLowerCase()

    // A browser can retain a refresh token that has since been revoked or
    // removed from Supabase. Clear only the local session so the next login
    // starts from a clean state without signing the user out elsewhere.
    if (
      message.includes('refresh token') ||
      message.includes('session not found') ||
      message.includes('jwt expired')
    ) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
    }

    return null
  }
  return data.user ?? null
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase n’est pas configuré.')
  }

  return supabase
}

export async function signInWithPassword(
  email: string,
  password: string,
) {
  const client = requireSupabase()
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error
  return data
}

export async function signUpWithPassword(input: {
  displayName: string
  email: string
  password: string
}) {
  const client = requireSupabase()
  const { data, error } = await client.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: window.location.origin,
      data: {
        display_name: input.displayName,
      },
    },
  })

  if (error) throw error

  return {
    user: data.user,
    session: data.session,
    requiresEmailConfirmation: !data.session,
  }
}

export async function resendSignupConfirmation(
  email: string,
) {
  const client = requireSupabase()
  const { error } = await client.auth.resend({
    type: 'signup',
