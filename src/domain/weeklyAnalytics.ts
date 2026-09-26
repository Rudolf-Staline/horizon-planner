import type {
  PlannerEvent,
} from './types'
import {
  formatDayHeading,
  toISODate,
  weekDates,
} from '../utils/date'

export function buildWeeklyAnalytics(
  events: PlannerEvent[],
  anchor: Date,
) {
  const dates = weekDates(anchor)
  const weekDateSet =
    new Set(
      dates.map(toISODate),
    )

  const active =
    events.filter(
      (event) =>
        !event.completed &&
        Boolean(event.date) &&
        weekDateSet.has(
          event.date!,
        ),
    )

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
    byDay,
    max,
    busiest,
  }
}
