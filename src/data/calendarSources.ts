import { supabase } from '../lib/supabase'

export type CalendarSource = {
  id: string
  provider: 'ics' | 'google' | 'outlook'
  name: string
  feedUrl: string
  enabled: boolean
  lastSyncedAt: string | null
  lastError: string | null
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase n’est pas configuré.')
  return supabase
}

export async function listCalendarSources(userId: string): Promise<CalendarSource[]> {
  const { data, error } = await requireSupabase().from('calendar_sources').select('id,provider,name,feed_url,enabled,last_synced_at,last_error').eq('user_id', userId).order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((source) => ({ id: source.id, provider: source.provider, name: source.name, feedUrl: source.feed_url, enabled: source.enabled, lastSyncedAt: source.last_synced_at, lastError: source.last_error }))
}

export async function createCalendarSource(userId: string, input: { provider: CalendarSource['provider']; name: string; feedUrl: string }) {
  const { data, error } = await requireSupabase().from('calendar_sources').insert({ user_id: userId, provider: input.provider, name: input.name, feed_url: input.feedUrl }).select('id').single()
  if (error) throw error
  return data.id as string
}

export async function deleteCalendarSource(sourceId: string) {
  const { error } = await requireSupabase().from('calendar_sources').delete().eq('id', sourceId)
  if (error) throw error
}

export async function syncCalendarSource(sourceId: string) {
  const client = requireSupabase()
  const { data, error } = await client.functions.invoke('sync-ics', { body: { sourceId } })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data as { imported: number }
}
