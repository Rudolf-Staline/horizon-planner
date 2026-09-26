import type { Category, PlannerEvent } from '../domain/types'
import {
  addDays,
  fromISODate,
  toISODate,
  weekdayIndex,
} from '../utils/date'
import { supabase } from '../lib/supabase'

export type Routine = {
  id: string
  projectId: string | null
  title: string
  category: Category
  durationMin: number
  days: number[]
  preferredStart: string | null
  active: boolean
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase n’est pas configuré.')
  }
  return supabase
}

export async function listRoutines(
  userId: string,
): Promise<Routine[]> {
  const client = requireSupabase()

  const { data, error } = await client
    .from('routines')
    .select(
      'id,project_id,title,category,duration_min,days,preferred_start,active',
    )
    .eq('user_id', userId)
    .order('active', {
      ascending: false,
    })
    .order('updated_at', {
      ascending: false,
    })

  if (error) throw error

  return (data ?? []).map((routine) => ({
    id: routine.id,
    projectId:
      routine.project_id ?? null,
    title: routine.title,
    category: routine.category,
    durationMin:
      routine.duration_min,
    days: routine.days ?? [],
    preferredStart:
      routine.preferred_start ?? null,
    active: routine.active,
  }))
}

export async function createRoutine(
  userId: string,
  input: {
    title: string
    projectId?: string
    durationMin: number
    days: number[]
    preferredStart?: string
  },
) {
  const client = requireSupabase()

  const { error } = await client
    .from('routines')
    .insert({
      user_id: userId,
      project_id:
        input.projectId || null,
      title: input.title,
      category: 'routine',
      duration_min:
        input.durationMin,
      days: input.days,
      preferred_start:
        input.preferredStart
          ? `${input.preferredStart}:00`
          : null,
      active: true,
    })

  if (error) throw error
}

export async function updateRoutine(
  routineId: string,
  patch: {
    title?: string
    projectId?: string | null
    durationMin?: number
    days?: number[]
    preferredStart?: string | null
  },
) {
  const client = requireSupabase()
  const payload: Record<string, unknown> = {}

  if (patch.title !== undefined) {
    payload.title = patch.title
  }
  if (patch.projectId !== undefined) {
    payload.project_id =
      patch.projectId || null
  }
  if (patch.durationMin !== undefined) {
    payload.duration_min =
      patch.durationMin
  }
  if (patch.days !== undefined) {
    payload.days = patch.days
  }
  if (patch.preferredStart !== undefined) {
    payload.preferred_start =
      patch.preferredStart
        ? `${patch.preferredStart}:00`
        : null
  }

  const { error } = await client
    .from('routines')
    .update(payload)
    .eq('id', routineId)

  if (error) throw error
}

export async function setRoutineActive(
  routineId: string,
  active: boolean,
) {
  const client = requireSupabase()

  const { error } = await client
    .from('routines')
    .update({ active })
    .eq('id', routineId)

  if (error) throw error
}

export async function deleteRoutine(
  routineId: string,
) {
  const client = requireSupabase()

  const { error } = await client
    .from('routines')
    .delete()
    .eq('id', routineId)

  if (error) throw error
}

function startMinutes(
  preferredStart: string | null,
) {
  if (!preferredStart) return 8 * 60

  const [hour, minute] =
    preferredStart
      .split(':')
      .map(Number)

  return hour * 60 + minute
}

export function expandRoutines(
  routines: Routine[],
  startDate: string,
  endDate: string,
): PlannerEvent[] {
  const start = fromISODate(startDate)
  const end = fromISODate(endDate)
  const events: PlannerEvent[] = []

  for (
    let cursor = start;
    cursor.getTime() <= end.getTime();
    cursor = addDays(cursor, 1)
  ) {
    const day = weekdayIndex(cursor)
    const date = toISODate(cursor)

    for (const routine of routines) {
      if (
        !routine.active ||
        !routine.days.includes(day)
      ) {
        continue
      }

      events.push({
        id:
          `routine:${routine.id}:${date}`,
        entityType: 'routine',
        title: routine.title,
        date,
        day,
        startMin:
          startMinutes(
            routine.preferredStart,
          ),
        durationMin:
          routine.durationMin,
        category:
          routine.category,
        projectId:
          routine.projectId ?? undefined,
        routineId:
          routine.id,
        virtual: true,
        kind: 'fixed',
        locked: true,
      })
    }
  }

  return events
}
