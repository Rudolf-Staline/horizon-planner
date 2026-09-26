import type { PlannerEvent } from '../domain/types'
import {
  dateForWeekday,
  fromISODate,
  toISODate,
  weekdayIndex,
} from '../utils/date'
import { supabase } from '../lib/supabase'

export type NormalizedPlannerSnapshot = {
  events: PlannerEvent[]
  modifiedAt: number
}

function localDateTimeToIso(
  date: string,
  minutes: number,
) {
  const local = fromISODate(date)
  local.setHours(
    Math.floor(minutes / 60),
    minutes % 60,
    0,
    0,
  )
  return local.toISOString()
}

function minutesFromDate(date: Date) {
  return date.getHours() * 60 + date.getMinutes()
}

function timeValue(minutes?: number) {
  if (minutes === undefined) return null

  const hour = String(
    Math.floor(minutes / 60),
  ).padStart(2, '0')
  const minute = String(
    minutes % 60,
  ).padStart(2, '0')

  return `${hour}:${minute}:00`
}

function parseTimeValue(value: string | null) {
  if (!value) return undefined

  const [hour, minute] =
    value.split(':').map(Number)

  return hour * 60 + minute
}

function maxTimestamp(
  values: Array<string | null | undefined>,
) {
  let latest = 0

  for (const value of values) {
    if (!value) continue
    latest = Math.max(
      latest,
      new Date(value).getTime(),
    )
  }

  return latest
}

export async function loadNormalizedPlanner(
  userId: string,
): Promise<NormalizedPlannerSnapshot | null> {
  if (!supabase) return null

  const [
    tasksResult,
    constraintsResult,
    segmentsResult,
    calendarResult,
  ] = await Promise.all([
    supabase
      .from('tasks')
      .select(
        'id,title,category,priority,kind,duration_min,locked,status,updated_at',
      )
      .eq('user_id', userId),
    supabase
      .from('task_constraints')
      .select(
        'task_id,earliest_date,deadline_date,window_start,window_end,energy,splittable,min_chunk_min,updated_at',
      )
      .eq('user_id', userId),
    supabase
      .from('planned_segments')
      .select(
        'id,task_id,starts_at,ends_at,status,updated_at',
      )
      .eq('user_id', userId)
      .not('task_id', 'is', null),
    supabase
      .from('calendar_events')
      .select(
        'id,title,category,starts_at,ends_at,locked,updated_at',
      )
      .eq('user_id', userId)
      .eq('source', 'manual'),
  ])

  for (const result of [
    tasksResult,
    constraintsResult,
    segmentsResult,
    calendarResult,
  ]) {
    if (result.error) throw result.error
  }

  const tasks = tasksResult.data ?? []
  const segments = segmentsResult.data ?? []
  const calendarEvents = calendarResult.data ?? []

  if (
    tasks.length === 0 &&
    calendarEvents.length === 0
  ) {
    return null
  }

  const constraintByTask = new Map(
    (constraintsResult.data ?? []).map(
      (constraint) => [
        constraint.task_id,
        constraint,
      ],
    ),
  )

  const segmentsByTask = new Map<
    string,
    typeof segments
  >()

  for (const segment of segments) {
    if (!segment.task_id) continue

    const current =
      segmentsByTask.get(segment.task_id) ?? []
    current.push(segment)
    segmentsByTask.set(
      segment.task_id,
      current,
    )
  }

  const events: PlannerEvent[] = []

  for (const task of tasks) {
    const taskSegments =
      segmentsByTask.get(task.id) ?? []

    for (
      let index = 0;
      index < taskSegments.length;
      index++
    ) {
      const segment = taskSegments[index]
      const starts = new Date(
        segment.starts_at,
      )
      const ends = new Date(
        segment.ends_at,
      )
      const date = toISODate(starts)
      const constraint =
        constraintByTask.get(task.id)

      const deadlineDay =
        constraint?.deadline_date
          ? weekdayIndex(
              fromISODate(
                constraint.deadline_date,
              ),
            )
          : undefined

      events.push({
        id:
          index === 0
            ? task.id
            : segment.id,
        title:
          taskSegments.length > 1
            ? `${task.title} · ${index + 1}/${taskSegments.length}`
            : task.title,
        date,
        day: weekdayIndex(starts),
        startMin: minutesFromDate(starts),
        durationMin: Math.max(
          15,
          Math.round(
            (ends.getTime() -
              starts.getTime()) /
              60_000,
          ),
        ),
        category: task.category,
        priority: task.priority,
        kind: task.kind,
        locked: task.locked,
        completed:
          task.status === 'completed' ||
          segment.status === 'completed',
        deadlineDay,
        windowStartMin:
          parseTimeValue(
            constraint?.window_start ??
              null,
          ),
        windowEndMin:
          parseTimeValue(
            constraint?.window_end ??
              null,
          ),
        energy:
          constraint?.energy ??
          undefined,
        splittable:
          constraint?.splittable ??
          undefined,
        minChunkMin:
          constraint?.min_chunk_min ??
          undefined,
      })
    }
  }

  for (const item of calendarEvents) {
    const starts = new Date(item.starts_at)
    const ends = new Date(item.ends_at)

    events.push({
      id: item.id,
      title: item.title,
      date: toISODate(starts),
      day: weekdayIndex(starts),
      startMin: minutesFromDate(starts),
      durationMin: Math.max(
        15,
        Math.round(
          (ends.getTime() -
            starts.getTime()) /
            60_000,
        ),
      ),
      category: item.category,
      kind: 'fixed',
      locked: item.locked,
    })
  }

  const modifiedAt = maxTimestamp([
    ...tasks.map(
      (item) => item.updated_at,
    ),
    ...segments.map(
      (item) => item.updated_at,
    ),
    ...(constraintsResult.data ?? []).map(
      (item) => item.updated_at,
    ),
    ...calendarEvents.map(
      (item) => item.updated_at,
    ),
  ])

  return {
    events,
    modifiedAt,
  }
}

export async function syncNormalizedPlanner(
  userId: string,
  events: PlannerEvent[],
) {
  if (!supabase) return

  const calendarEvents =
    events.filter(
      (event) =>
        event.kind === 'fixed' &&
        Boolean(event.locked),
    )

  const taskEvents =
    events.filter(
      (event) =>
        !(
          event.kind === 'fixed' &&
          Boolean(event.locked)
        ),
    )

  const [
    clearConstraints,
    clearSegments,
    clearCalendar,
  ] = await Promise.all([
    supabase
      .from('task_constraints')
      .delete()
      .eq('user_id', userId),
    supabase
      .from('planned_segments')
      .delete()
      .eq('user_id', userId),
    supabase
      .from('calendar_events')
      .delete()
      .eq('user_id', userId)
      .eq('source', 'manual'),
  ])

  for (const result of [
    clearConstraints,
    clearSegments,
    clearCalendar,
  ]) {
    if (result.error) throw result.error
  }

  const taskIds =
    taskEvents.map((event) => event.id)

  if (taskIds.length > 0) {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('user_id', userId)
      .not('id', 'in', `(${taskIds.join(',')})`)

    if (error) throw error
  } else {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('user_id', userId)

    if (error) throw error
  }

  if (taskEvents.length > 0) {
    const { error } = await supabase
      .from('tasks')
      .upsert(
        taskEvents.map((event) => ({
          id: event.id,
          user_id: userId,
          project_id: null,
          title: event.title,
          notes: null,
          category: event.category,
          priority:
            event.priority ?? 'medium',
          kind: event.kind,
          duration_min:
            event.durationMin,
          locked:
            Boolean(event.locked),
          status:
            event.completed
              ? 'completed'
              : 'planned',
          completed_at:
            event.completed
              ? new Date().toISOString()
              : null,
        })),
        {
          onConflict: 'id',
        },
      )

    if (error) throw error

    const dated =
      taskEvents.filter(
        (event) => event.date,
      )

    if (dated.length > 0) {
      const { error: segmentError } =
        await supabase
          .from('planned_segments')
          .insert(
            dated.map((event) => ({
              user_id: userId,
              task_id: event.id,
              routine_id: null,
              starts_at:
                localDateTimeToIso(
                  event.date!,
                  event.startMin,
                ),
              ends_at:
                localDateTimeToIso(
                  event.date!,
                  event.startMin +
                    event.durationMin,
                ),
              segment_index: 0,
              status:
                event.completed
                  ? 'completed'
                  : 'planned',
            })),
          )

      if (segmentError) {
        throw segmentError
      }
    }

    const flexible =
      taskEvents.filter(
        (event) =>
          event.kind === 'flexible',
      )

    if (flexible.length > 0) {
      const { error: constraintError } =
        await supabase
          .from('task_constraints')
          .insert(
            flexible.map((event) => ({
              task_id: event.id,
              user_id: userId,
              earliest_date:
                event.date ?? null,
              deadline_date:
                event.date &&
                event.deadlineDay !==
                  undefined
                  ? dateForWeekday(
                      event.date,
                      event.deadlineDay,
                    )
                  : null,
              window_start:
                timeValue(
                  event.windowStartMin,
                ),
              window_end:
                timeValue(
                  event.windowEndMin,
                ),
              energy:
                event.energy ?? null,
              splittable:
                Boolean(
                  event.splittable,
                ),
              min_chunk_min:
                event.minChunkMin ??
                null,
            })),
          )

      if (constraintError) {
        throw constraintError
      }
    }
  }

  if (calendarEvents.length > 0) {
    const { error } = await supabase
      .from('calendar_events')
      .insert(
        calendarEvents
          .filter((event) => event.date)
          .map((event) => ({
            id: event.id,
            user_id: userId,
            project_id: null,
            title: event.title,
            category: event.category,
            starts_at:
              localDateTimeToIso(
                event.date!,
                event.startMin,
              ),
            ends_at:
              localDateTimeToIso(
                event.date!,
                event.startMin +
                  event.durationMin,
              ),
            locked:
              Boolean(event.locked),
            source: 'manual',
            external_id: null,
          })),
      )

    if (error) throw error
  }
}
