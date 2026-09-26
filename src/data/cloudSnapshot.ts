import type { User } from '@supabase/supabase-js'
import type { Category, EventKind, PlannerEvent } from '../domain/types'
import { supabase } from '../lib/supabase'

const categories = new Set<Category>([
  'course',
  'project',
  'personal',
  'focus',
  'routine',
  'admin',
  'flexible',
  'neutral',
])

const kinds = new Set<EventKind>(['fixed', 'flexible'])

function isPlannerEvent(value: unknown): value is PlannerEvent {
  if (!value || typeof value !== 'object') return false

  const event = value as Record<string, unknown>

  return (
    typeof event.id === 'string' &&
    typeof event.title === 'string' &&
    (event.date === undefined || typeof event.date === 'string') &&
    typeof event.day === 'number' &&
    event.day >= 0 &&
    event.day <= 6 &&
    typeof event.startMin === 'number' &&
    typeof event.durationMin === 'number' &&
    typeof event.category === 'string' &&
    categories.has(event.category as Category) &&
    typeof event.kind === 'string' &&
    kinds.has(event.kind as EventKind)
  )
}

function parsePlannerEvents(value: unknown): PlannerEvent[] | null {
  if (!Array.isArray(value)) return null
  if (!value.every(isPlannerEvent)) return null
  return value
}

export type CloudSnapshot = {
  events: PlannerEvent[]
  modifiedAt: number
}

export async function currentCloudUser(): Promise<User | null> {
  if (!supabase) return null

  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return data.user ?? null
}

export async function loadCloudSnapshot(
  userId: string,
): Promise<CloudSnapshot | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('planner_snapshots')
    .select('payload, client_updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const events = parsePlannerEvents(data.payload)
  if (!events) {
    throw new Error('Cloud snapshot payload has an invalid shape.')
  }

  return {
    events,
    modifiedAt: new Date(data.client_updated_at).getTime(),
  }
}

export async function saveCloudSnapshot(
  userId: string,
  events: PlannerEvent[],
  modifiedAt: number,
) {
  if (!supabase) return

  const { error } = await supabase
    .from('planner_snapshots')
    .upsert({
      user_id: userId,
      schema_version: 1,
      payload: events,
      client_updated_at: new Date(modifiedAt).toISOString(),
    }, {
      onConflict: 'user_id',
    })

  if (error) throw error
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
