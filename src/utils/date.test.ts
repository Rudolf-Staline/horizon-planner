import { describe, expect, it } from 'vitest'
import {
  dateForWeekday,
  migrateLegacyEventDates,
  startOfWeek,
  toISODate,
  weekdayIndex,
} from './date'
import type { PlannerEvent } from '../domain/types'

describe('calendar dates', () => {
  it('uses Monday as the first day of the week', () => {
    const saturday = new Date(2026, 8, 26, 12)
    expect(toISODate(startOfWeek(saturday))).toBe('2026-09-21')
    expect(weekdayIndex(saturday)).toBe(5)
  })

  it('maps a weekly planner day to a concrete date', () => {
    expect(dateForWeekday('2026-09-26', 0)).toBe('2026-09-21')
    expect(dateForWeekday('2026-09-26', 6)).toBe('2026-09-27')
  })

  it('migrates legacy day-only events into the current week', () => {
    const event: PlannerEvent = {
      id: 'legacy',
      title: 'Legacy',
      day: 2,
      startMin: 600,
      durationMin: 60,
      category: 'focus',
      kind: 'flexible',
    }

    const migration = migrateLegacyEventDates(
      [event],
      new Date(2026, 8, 26, 12),
    )

    expect(migration.changed).toBe(true)
    expect(migration.events[0].date).toBe('2026-09-23')
  })
})
