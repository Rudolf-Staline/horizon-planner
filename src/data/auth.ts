import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export async function currentCloudUser(): Promise<User | null> {
  if (!supabase) return null

  const { data, error } = await supabase.auth.getUser()
  if (error) return null
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

export async function requestPasswordReset(email: string) {
  const client = requireSupabase()
  const { error } = await client.auth.resetPasswordForEmail(
    email,
    {
      redirectTo: window.location.origin,
    },
  )

  if (error) throw error
}

export async function updatePassword(password: string) {
  const client = requireSupabase()
  const { error } = await client.auth.updateUser({
    password,
  })

  if (error) throw error
}

export async function signOut() {
  if (!supabase) return

  const { error } = await supabase.auth.signOut({
    scope: 'local',
  })

  if (error) throw error
}
