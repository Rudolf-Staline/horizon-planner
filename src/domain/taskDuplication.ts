import { planFlexibleTask } from './scheduling'
import type { SchedulingOptions } from './scheduling'
import {
  addDays,
  fromISODate,
  toISODate,
  weekdayIndex,
} from '../utils/date'
import type { PlannerEvent } from './types'

export type DuplicateTaskResult =
  | {
      ok: true
      events: PlannerEvent[]
      selectedId: string
    }
  | {
      ok: false
      message: string
    }

function sortSegments(segments: PlannerEvent[]) {
  return [...segments].sort(
    (a, b) =>
      (a.segmentIndex ?? Number.MAX_SAFE_INTEGER) -
        (b.segmentIndex ?? Number.MAX_SAFE_INTEGER) ||
      (a.date ?? '').localeCompare(b.date ?? '') ||
      a.startMin - b.startMin,
  )
}

export function duplicateTask(
  target: PlannerEvent,
  taskSegments: PlannerEvent[],
  events: PlannerEvent[],
  todayDate: string,
  options: SchedulingOptions,
  currentMinutes = 0,
): DuplicateTaskResult {
  if (target.entityType !== 'task') {
    return {
      ok: false,
      message: 'Seules les tâches peuvent être dupliquées.',
    }
  }

  const segments = sortSegments(
    taskSegments.length > 0
      ? taskSegments
      : [target],
  )
  const first = segments[0]
  const firstDate = first.date && first.date > todayDate
    ? first.date
    : todayDate
  const deadlineDate = first.deadlineDate &&
    first.deadlineDate >= firstDate
    ? first.deadlineDate
    : undefined
  const taskId = crypto.randomUUID()
  // A task without a deadline still needs a search window beyond Sunday.
  const searchDeadline = deadlineDate ??
    toISODate(addDays(fromISODate(firstDate), 7))
  const placementDraft: PlannerEvent = {
    ...first,
    id: `duplicate:${taskId}`,
    taskId,
    entityType: 'task',
    date: firstDate,
    day: weekdayIndex(fromISODate(firstDate)),
    durationMin: segments.reduce(
      (total, segment) => total + segment.durationMin,
      0,
    ),
    kind: 'flexible',
    locked: false,
    completed: false,
    deadlineDate: searchDeadline,
    deadlineDay: weekdayIndex(fromISODate(searchDeadline)),
    splittable:
      first.kind === 'flexible' &&
      (segments.length > 1 || Boolean(first.splittable)),
    segmentIndex: 0,
    segmentCount: 1,
  }

  const blockers = [...events]
  if (firstDate === todayDate && currentMinutes > 0) {
    const step = options.planningStepMin ?? 15
    const nextMinute = Math.min(
      1440,
      Math.ceil(currentMinutes / step) * step,
    )
    blockers.push({
      ...placementDraft,
      id: `elapsed:${taskId}`,
      date: todayDate,
      startMin: 0,
      durationMin: nextMinute,
      kind: 'fixed',
      locked: true,
    })
  }

  const plan = planFlexibleTask(
    placementDraft,
    blockers,
    options,
  )

  if (!plan) {
    return {
      ok: false,
      message: 'Aucun créneau libre ne permet de placer la copie.',
    }
  }

  const copies = plan.placements.map(
    (placement, index): PlannerEvent => ({
      ...first,
      id: crypto.randomUUID(),
      entityType: 'task',
      source: 'manual',
      externalId: undefined,
      taskId,
      segmentIndex: index,
      segmentCount: plan.placements.length,
      date: placement.date ?? firstDate,
      day: placement.day,
      startMin: placement.startMin,
      durationMin: placement.durationMin,
      locked: false,
      completed: false,
      deadlineDate,
      deadlineDay: deadlineDate
        ? weekdayIndex(fromISODate(deadlineDate))
        : undefined,
    }),
  )

  return {
    ok: true,
    events: [...events, ...copies],
    selectedId: copies[0].id,
  }
}
