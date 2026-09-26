import type {
  PlannerEvent,
} from '../domain/types'
import {
  baseTaskTitle,
  groupTaskEvents,
  isCalendarEntity,
} from '../domain/taskIdentity'
import {
  dateForWeekday,
  fromISODate,
} from '../utils/date'
import { localDateTimeToIso } from '../utils/timezone'

export type ExistingTaskState = {
  id: string
  status: string
  completed_at: string | null
}

function timeValue(
  minutes?: number,
) {
  if (minutes === undefined) {
    return null
  }

  const hour = String(
    Math.floor(minutes / 60),
  ).padStart(2, '0')
  const minute = String(
    minutes % 60,
  ).padStart(2, '0')

  return `${hour}:${minute}:00`
}

export function buildNormalizedPlannerRows(
  userId: string,
  events: PlannerEvent[],
  existingTaskById:
    Map<string, ExistingTaskState>,
  nowIso = () =>
    new Date().toISOString(),
  timeZone = 'UTC',
) {
  const calendarEvents =
    events.filter(
      (event) =>
        !event.virtual &&
        isCalendarEntity(event),
    )

  const taskGroups =
    groupTaskEvents(events)
  const taskIds =
    [...taskGroups.keys()]

  const taskRows =
    [...taskGroups.entries()].map(
      ([taskId, segments]) => {
        const primary = segments[0]
        const completed =
          segments.length > 0 &&
          segments.every(
            (segment) =>
              segment.completed,
          )
        const existing =
          existingTaskById.get(
            taskId,
          )

        return {
          id: taskId,
          user_id: userId,
          project_id:
            primary.projectId ??
            null,
          title:
            baseTaskTitle(
              primary.title,
            ),
          notes: primary.notes ?? null,
          category:
            primary.category,
          priority:
            primary.priority ??
            'medium',
          kind: primary.kind,
          duration_min:
            segments.reduce(
              (
                total,
                segment,
              ) =>
                total +
                segment.durationMin,
              0,
            ),
          locked:
            segments.every(
              (segment) =>
                Boolean(
                  segment.locked,
                ),
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
                    : nowIso()
                )
              : null,
        }
      },
    )

  const segmentRows =
    [...taskGroups.entries()]
      .flatMap(
        ([taskId, segments]) =>
          segments
            .filter(
              (event) =>
                event.date,
            )
            .map(
              (
                event,
                index,
              ) => ({
                id: event.id,
                user_id:
                  userId,
                task_id:
                  taskId,
                routine_id:
                  null,
                starts_at:
                  localDateTimeToIso(
                    event.date!,
                    event.startMin,
                    timeZone,
                  ),
                ends_at:
                  localDateTimeToIso(
                    event.date!,
                    event.startMin +
                      event.durationMin,
                    timeZone,
                  ),
                segment_index:
                  event.segmentIndex ??
                  index,
                status:
                  event.completed
                    ? 'completed'
                    : 'planned',
              }),
            ),
      )

  const constraintRows =
    [...taskGroups.entries()]
      .filter(
        ([, segments]) =>
          segments[0]?.kind ===
          'flexible',
      )
      .map(
        ([taskId, segments]) => {
          const primary =
            segments[0]

          return {
            task_id:
              taskId,
            user_id:
              userId,
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
                .sort()[0] ??
              null,
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
              primary.energy ??
              null,
            splittable:
              segments.length > 1 ||
              Boolean(
                primary.splittable,
              ),
            min_chunk_min:
              primary.minChunkMin ??
              null,
          }
        },
      )

  const fixedTaskIds =
    [...taskGroups.entries()]
      .filter(
        ([, segments]) =>
          segments[0]?.kind !==
          'flexible',
      )
      .map(
        ([taskId]) => taskId,
      )

  const calendarRows =
    calendarEvents
      .filter(
        (event) =>
          event.date,
      )
      .map(
        (event) => ({
          id: event.id,
          user_id: userId,
          project_id:
            event.projectId ??
            null,
          title: event.title,
          category:
            event.category,
          starts_at:
            localDateTimeToIso(
              event.date!,
              event.startMin,
              timeZone,
            ),
          ends_at:
            localDateTimeToIso(
              event.date!,
              event.startMin +
                event.durationMin,
              timeZone,
            ),
          locked:
            Boolean(
              event.locked,
            ),
          source: 'manual',
          external_id: null,
        }),
      )

  return {
    taskIds,
    taskRows,
    segmentRows,
    constraintRows,
    fixedTaskIds,
    calendarRows,
  }
}
