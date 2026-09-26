import { describe, expect, it } from 'vitest'
import {
  localDateTimeToIso,
  zonedDateMinutes,
  zonedDateToIso,
} from './timezone'

describe('timezone conversion', () => {
  it('persists a local planner time as the correct UTC instant', () => {
    const iso = localDateTimeToIso(
      '2026-01-15',
      8 * 60,
      'America/New_York',
    )

    expect(iso).toBe('2026-01-15T13:00:00.000Z')
  })

  it('reads a stored instant back in the configured zone', () => {
    const instant = new Date('2026-07-15T14:30:00.000Z')

    expect(zonedDateToIso(instant, 'America/New_York')).toBe('2026-07-15')
    expect(zonedDateMinutes(instant, 'America/New_York')).toBe(10 * 60 + 30)
  })
})
