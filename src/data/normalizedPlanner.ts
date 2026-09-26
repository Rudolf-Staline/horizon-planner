import type { PlannerEvent } from '../domain/types'
import {
  fromISODate,
  toISODate,
  weekdayIndex,
} from '../utils/date'
import {
  buildNormalizedPlannerRows,
} from './normalizedPlannerMapping'
import { supabase } from '../lib/supabase'

export type NormalizedPlannerSnapshot = {
  events: PlannerEvent[]
  modifiedAt: number
}

function minutesFromDate(date: Date) {
  return date.getHours() * 60 + date.getMinutes()
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
    if (result.error) {
      throw result.error
    }
  }

  const existingTaskById =
    new Map(
      (
        existingTasksResult.data ??
        []
      ).map(
        (task) => [
          task.id,
          task,
        ],
      ),
    )

  const {
    taskIds,
    taskRows,
    segmentRows,
    constraintRows,
    fixedTaskIds,
    calendarRows,
  } =
    buildNormalizedPlannerRows(
      userId,
      events,
      existingTaskById,
    )

  if (taskRows.length > 0) {
    const { error } =
      await supabase
        .from('tasks')
        .upsert(
          taskRows,
          {
            onConflict: 'id',
          },
        )

    if (error) throw error
  }

  if (segmentRows.length > 0) {
    const { error } =
      await supabase
        .from(
          'planned_segments',
        )
        .upsert(
          segmentRows,
          {
            onConflict: 'id',
          },
        )

    if (error) throw error
  }

  if (
    constraintRows.length >
    0
  ) {
    const { error } =
      await supabase
        .from(
          'task_constraints',
        )
        .upsert(
          constraintRows,
          {
            onConflict:
              'task_id',
          },
        )

    if (error) throw error
  }

  if (
    fixedTaskIds.length > 0
  ) {
    const { error } =
      await supabase
        .from(
          'task_constraints',
        )
        .delete()
        .eq(
          'user_id',
          userId,
        )
        .in(
          'task_id',
          fixedTaskIds,
        )

    if (error) throw error
  }

  if (
    calendarRows.length > 0
  ) {
    const { error } =
      await supabase
        .from(
          'calendar_events',
        )
        .upsert(
          calendarRows,
          {
            onConflict: 'id',
          },
        )

    if (error) throw error
  }

  const nextSegmentIds =
    new Set(
      segmentRows.map(
        (segment) =>
          segment.id,
      ),
    )

  const staleSegmentIds =
    (
      existingSegmentsResult.data ??
      []
    )
      .map(
        (segment) =>
          segment.id,
      )
      .filter(
        (id) =>
          !nextSegmentIds.has(id),
      )

  if (
    staleSegmentIds.length > 0
  ) {
    const { error } =
      await supabase
        .from(
          'planned_segments',
        )
        .delete()
        .eq(
          'user_id',
          userId,
        )
        .in(
          'id',
          staleSegmentIds,
        )

    if (error) throw error
  }

  const nextCalendarIds =
    new Set(
      calendarRows.map(
        (event) => event.id,
      ),
    )

  const staleCalendarIds =
    (
      existingCalendarResult.data ??
      []
    )
      .map(
        (event) =>
          event.id,
      )
      .filter(
        (id) =>
          !nextCalendarIds.has(
            id,
          ),
      )

  if (
    staleCalendarIds.length >
    0
  ) {
    const { error } =
      await supabase
        .from(
          'calendar_events',
        )
        .delete()
        .eq(
          'user_id',
          userId,
        )
        .eq(
          'source',
          'manual',
        )
        .in(
          'id',
          staleCalendarIds,
        )

    if (error) throw error
  }

  const currentTaskIds =
    new Set(taskIds)

  const staleScheduledIds =
    (
      existingTasksResult.data ??
      []
    )
      .filter(
        (task) =>
          task.status !== 'open' &&
          !currentTaskIds.has(
            task.id,
          ),
      )
      .map(
        (task) => task.id,
      )

  if (
    staleScheduledIds.length >
    0
  ) {
    const { error } =
      await supabase
        .from('tasks')
        .delete()
        .eq(
          'user_id',
          userId,
        )
        .in(
          'id',
          staleScheduledIds,
        )

    if (error) throw error
  }
}
