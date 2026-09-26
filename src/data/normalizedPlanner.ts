import type { PlannerEvent } from '../domain/types'
import {
  baseTaskTitle,
  groupTaskEvents,
  isCalendarEntity,
  logicalTaskId,
} from '../domain/taskIdentity'
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
        'id,project_id,title,category,priority,kind,duration_min,locked,status,updated_at',
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
        'id,task_id,starts_at,ends_at,segment_index,status,updated_at',
      )
      .eq('user_id', userId)
      .not('task_id', 'is', null),
    supabase
      .from('calendar_events')
      .select(
        'id,project_id,title,category,starts_at,ends_at,locked,updated_at',
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
        id: segment.id,
        entityType: 'task',
        taskId: task.id,
        segmentIndex:
          segment.segment_index ?? index,
        segmentCount: taskSegments.length,
        title: task.title,
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
        projectId: task.project_id ?? undefined,
        priority: task.priority,
        kind: task.kind,
        locked: task.locked,
        completed:
          task.status === 'completed' ||
          segment.status === 'completed',
        deadlineDay,
        deadlineDate:
          constraint?.deadline_date ??
          undefined,
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
      entityType: 'calendar',
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
      projectId: item.project_id ?? undefined,
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
        !event.virtual &&
        isCalendarEntity(event),
    )

  const taskGroups = groupTaskEvents(events)
  const taskIds = [...taskGroups.keys()]

  const [
    existingTasksResult,
    existingSegmentsResult,
    existingCalendarResult,
  ] = await Promise.all([
    supabase
      .from('tasks')
      .select('id,status,completed_at')
      .eq('user_id', userId),
    supabase
      .from('planned_segments')
      .select('id')
      .eq('user_id', userId)
      .not('task_id', 'is', null),
    supabase
      .from('calendar_events')
      .select('id')
      .eq('user_id', userId)
      .eq('source', 'manual'),
  ])

  for (const result of [
    existingTasksResult,
    existingSegmentsResult,
    existingCalendarResult,
  ]) {
    if (result.error) throw result.error
  }

  const existingTaskById = new Map(
    (existingTasksResult.data ?? []).map(
      (task) => [task.id, task],
    ),
  )

  const taskRows = [...taskGroups.entries()].map(
    ([taskId, segments]) => {
      const primary = segments[0]
      const completed =
        segments.length > 0 &&
        segments.every(
          (segment) => segment.completed,
        )
      const existing =
        existingTaskById.get(taskId)

      return {
        id: taskId,
        user_id: userId,
        project_id:
          primary.projectId ?? null,
        title:
          baseTaskTitle(primary.title),
        notes: null,
        category: primary.category,
        priority:
          primary.priority ?? 'medium',
        kind: primary.kind,
        duration_min:
          segments.reduce(
            (total, segment) =>
              total +
              segment.durationMin,
            0,
          ),
        locked:
          segments.every(
            (segment) =>
              Boolean(segment.locked),
          ),
        status:
          completed
            ? 'completed'
            : 'planned',
        completed_at:
          completed
            ? (
                existing?.status ===
                  'completed' &&
                existing.completed_at
                  ? existing.completed_at
                  : new Date().toISOString()
              )
            : null,
      }
    },
  )

  if (taskRows.length > 0) {
    const { error } = await supabase
      .from('tasks')
      .upsert(taskRows, {
        onConflict: 'id',
      })

    if (error) throw error
  }

  const segmentRows =
    [...taskGroups.entries()]
      .flatMap(
        ([taskId, segments]) =>
          segments
            .filter(
              (event) => event.date,
            )
            .map((event, index) => ({
              id: event.id,
              user_id: userId,
              task_id: taskId,
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
              segment_index:
                event.segmentIndex ??
                index,
              status:
                event.completed
                  ? 'completed'
                  : 'planned',
            })),
      )

  if (segmentRows.length > 0) {
    const { error } = await supabase
      .from('planned_segments')
      .upsert(segmentRows, {
        onConflict: 'id',
      })

    if (error) throw error
  }

  const constraintRows =
    [...taskGroups.entries()]
      .filter(
        ([, segments]) =>
          segments[0]?.kind ===
          'flexible',
      )
      .map(([taskId, segments]) => {
        const primary = segments[0]

        return {
          task_id: taskId,
          user_id: userId,
          earliest_date:
            segments
              .map(
                (event) =>
                  event.date,
              )
              .filter(
                (
                  value,
                ): value is string =>
                  Boolean(value),
              )
              .sort()[0] ?? null,
          deadline_date:
            primary.deadlineDate ??
            (
              primary.date &&
              primary.deadlineDay !==
                undefined
                ? dateForWeekday(
                    primary.date,
                    primary.deadlineDay,
                  )
                : null
            ),
          window_start:
            timeValue(
              primary.windowStartMin,
            ),
          window_end:
            timeValue(
              primary.windowEndMin,
            ),
          energy:
            primary.energy ?? null,
          splittable:
            segments.length > 1 ||
            Boolean(
              primary.splittable,
            ),
          min_chunk_min:
            primary.minChunkMin ??
            null,
        }
      })

  if (constraintRows.length > 0) {
    const { error } = await supabase
      .from('task_constraints')
      .upsert(constraintRows, {
        onConflict: 'task_id',
      })

    if (error) throw error
  }

  const fixedTaskIds =
    [...taskGroups.entries()]
      .filter(
        ([, segments]) =>
          segments[0]?.kind !==
          'flexible',
      )
      .map(([taskId]) => taskId)

  if (fixedTaskIds.length > 0) {
    const { error } = await supabase
      .from('task_constraints')
      .delete()
      .eq('user_id', userId)
      .in('task_id', fixedTaskIds)

    if (error) throw error
  }

  const calendarRows =
    calendarEvents
      .filter(
        (event) => event.date,
      )
      .map((event) => ({
        id: event.id,
        user_id: userId,
        project_id:
          event.projectId ?? null,
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
      }))

  if (calendarRows.length > 0) {
    const { error } = await supabase
      .from('calendar_events')
      .upsert(calendarRows, {
        onConflict: 'id',
      })

    if (error) throw error
  }

  const nextSegmentIds =
    new Set(
      segmentRows.map(
        (segment) => segment.id,
      ),
    )
  const staleSegmentIds =
    (existingSegmentsResult.data ?? [])
      .map((segment) => segment.id)
      .filter(
        (id) =>
          !nextSegmentIds.has(id),
      )

  if (staleSegmentIds.length > 0) {
    const { error } = await supabase
      .from('planned_segments')
      .delete()
      .eq('user_id', userId)
      .in('id', staleSegmentIds)

    if (error) throw error
  }

  const nextCalendarIds =
    new Set(
      calendarRows.map(
        (event) => event.id,
      ),
    )
  const staleCalendarIds =
    (existingCalendarResult.data ?? [])
      .map((event) => event.id)
      .filter(
        (id) =>
          !nextCalendarIds.has(id),
      )

  if (staleCalendarIds.length > 0) {
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('user_id', userId)
      .eq('source', 'manual')
      .in('id', staleCalendarIds)

    if (error) throw error
  }

  const currentTaskIds =
    new Set(taskIds)
  const staleScheduledIds =
    (existingTasksResult.data ?? [])
      .filter(
        (task) =>
          task.status !== 'open' &&
          !currentTaskIds.has(
            task.id,
          ),
      )
      .map((task) => task.id)

  if (
    staleScheduledIds.length > 0
  ) {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('user_id', userId)
      .in(
        'id',
        staleScheduledIds,
      )

    if (error) throw error
  }
}
