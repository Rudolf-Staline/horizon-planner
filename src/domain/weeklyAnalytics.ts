import type {
  PlannerEvent,
} from './types'
import { taskOverdueState } from './overdue'
import { groupTaskEvents } from './taskIdentity'
import {
  formatDayHeading,
  toISODate,
  weekDates,
} from '../utils/date'

export function buildWeeklyAnalytics(
  events: PlannerEvent[],
  anchor: Date,
  weekStartsOn = 1,
) {
  const dates = weekDates(anchor, weekStartsOn)
  const weekDateSet =
    new Set(
      dates.map(toISODate),
    )
  const todayDate = toISODate(anchor)
  const overdueTasks = [
    ...groupTaskEvents(events).values(),
  ]
    .map((segments) =>
      taskOverdueState(segments, todayDate),
    )
    .filter((state) => state !== null)

  const active =
    events.filter(
      (event) =>
        !event.completed &&
        Boolean(event.date) &&
        weekDateSet.has(
          event.date!,
        ),
    )

  const weekEvents = events.filter((event) => Boolean(event.date) && weekDateSet.has(event.date!))
  const completed = weekEvents.filter((event) => event.completed)
  const plannedMinutes = weekEvents.reduce((sum, event) => sum + event.durationMin, 0)
  const completedMinutes = completed.reduce((sum, event) => sum + event.durationMin, 0)

  const totalMinutes =
    active.reduce(
      (sum, event) =>
        sum +
        event.durationMin,
      0,
    )

  const focusMinutes =
    active
      .filter(
        (event) =>
          event.category ===
          'focus',
      )
      .reduce(
        (sum, event) =>
          sum +
          event.durationMin,
        0,
      )

  const routineMinutes =
    active
      .filter(
        (event) =>
          event.category ===
          'routine',
      )
      .reduce(
        (sum, event) =>
          sum +
          event.durationMin,
        0,
      )

  const byDay =
    dates.map((date) => {
      const iso =
        toISODate(date)
      const heading =
        formatDayHeading(date)

      return {
        date: iso,
        label:
          `${heading.weekday} ${heading.day}`,
        shortLabel:
          heading.weekday,
        minutes:
          active
            .filter(
              (event) =>
                event.date ===
                iso,
            )
            .reduce(
              (
                sum,
                event,
              ) =>
                sum +
                event.durationMin,
              0,
            ),
      }
    })

  const max =
    Math.max(
      ...byDay.map(
        (item) =>
          item.minutes,
      ),
      1,
    )

  const busiest =
    totalMinutes > 0
      ? byDay.reduce(
          (best, current) =>
            current.minutes >
            best.minutes
              ? current
              : best,
        )
      : null

  return {
    activeCount:
      active.length,
    totalMinutes,
    focusMinutes,
    routineMinutes,
    plannedMinutes,
    completedMinutes,
    completionRate: plannedMinutes > 0 ? Math.round((completedMinutes / plannedMinutes) * 100) : 0,
    overdueCount: overdueTasks.length,
    overdueMinutes: overdueTasks.reduce(
      (total, task) =>
        total + task.remainingMinutes,
      0,
    ),
    byDay,
    max,
    busiest,
  }
}
