import type { PlannerEvent } from './types'
import { taskProgress } from './taskIdentity'
import { fromISODate } from '../utils/date'

export type OverdueState = {
  deadlineDate: string
  days: number
  remainingMinutes: number
}

export function daysPastDeadline(
  deadlineDate: string,
  todayDate: string,
) {
  return Math.max(
    0,
    Math.round(
      (
        fromISODate(todayDate).getTime() -
        fromISODate(deadlineDate).getTime()
      ) / 86_400_000,
    ),
  )
}

export function isDeadlineOverdue(
  deadlineDate: string | null | undefined,
  completed: boolean,
  todayDate: string,
) {
  return Boolean(
    deadlineDate &&
    !completed &&
    deadlineDate < todayDate,
  )
}

export function taskOverdueState(
  segments: PlannerEvent[],
  todayDate: string,
): OverdueState | null {
  if (segments.length === 0) return null

  const progress = taskProgress(segments)
  const deadlineDate = segments
    .map((segment) => segment.deadlineDate)
    .filter((value): value is string => Boolean(value))
    .sort()[0]

  if (
    !deadlineDate ||
    !isDeadlineOverdue(
      deadlineDate,
      progress.completed,
      todayDate,
    )
  ) {
    return null
  }

  return {
    deadlineDate,
    days: daysPastDeadline(deadlineDate, todayDate),
    remainingMinutes: segments.reduce(
      (total, segment) =>
        total + (segment.completed ? 0 : segment.durationMin),
      0,
    ),
  }
}

export function overdueLabel(days: number) {
  return days === 1
    ? 'En retard d’un jour'
    : `En retard de ${days} jours`
}
