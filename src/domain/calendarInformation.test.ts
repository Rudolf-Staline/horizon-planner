import { describe, expect, it } from 'vitest'
import { isCalendarInformation } from './calendarInformation'
import { conflictsFor } from './scheduling'
import type { PlannerEvent } from './types'
const event: PlannerEvent = { id: 'a', title: 'Jour de l’an', date: '2027-01-01', day: 4, startMin: 510, durationMin: 555, category: 'course', kind: 'fixed', externalId: 'edt:s7:jan:B5' }
describe('semester information', () => {
  it('keeps exact school holiday labels informational without unlocking ordinary appointments', () => {
    const holiday = { ...event, title: "Jour de l'an" }
    expect(isCalendarInformation(holiday)).toBe(true)
    expect(conflictsFor({ ...event, id: 'task', title: 'Étudier', externalId: undefined }, [holiday])).toEqual([])
    expect(isCalendarInformation({ ...holiday, externalId: undefined })).toBe(false)
    expect(isCalendarInformation({ ...event, title: 'Examen Physique statistique' })).toBe(false)
  })
  it('allows work inside explicit free margins while preserving sleep as unavailable', () => {
    expect(isCalendarInformation({ ...event, externalId: 'life:s7-2026-2027:2027-01-01:margin:1' })).toBe(true)
    expect(isCalendarInformation({ ...event, externalId: 'life:s7-2026-2027:2027-01-01:sleep' })).toBe(false)
  })
})
