import { supabase } from '../lib/supabase'

export type UserRole = 'user' | 'admin'

export type UserProfile = {
  id: string
  displayName: string | null
  timezone: string
  role: UserRole
}

export async function loadOwnProfile(
  userId: string,
): Promise<UserProfile | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, timezone, role')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    id: data.id,
    displayName: data.display_name,
    timezone: data.timezone,
    role: data.role === 'admin' ? 'admin' : 'user',
  }
}

export async function updateDisplayName(
  userId: string,
  displayName: string,
) {
  if (!supabase) {
    throw new Error('Supabase n’est pas configuré.')
  }

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', userId)

  if (error) throw error

  const { error: metadataError } =
    await supabase.auth.updateUser({
      data: {
        display_name: displayName,
      },
    })

  if (metadataError) throw metadataError
}


export async function syncProfileTimezone(
  userId: string,
  timezone: string,
) {
  if (!supabase) return

  const { error } = await supabase
    .from('profiles')
    .update({ timezone })
    .eq('id', userId)

  if (error) throw error
}
