import { describe, expect, it } from 'vitest'
import { parseIcsEvents, plannerEventsToIcs } from './portable'

describe('portable calendar formats', () => {
  it('parses a basic UTC ICS event', () => {
    const events = parseIcsEvents([
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:abc-1',
      'DTSTART:20260928T080000Z',
      'DTEND:20260928T090000Z',
      'SUMMARY:Cours, analyse',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n'))

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      externalId: 'abc-1',
      title: 'Cours, analyse',
      startsAt: '2026-09-28T08:00:00.000Z',
      endsAt: '2026-09-28T09:00:00.000Z',
    })
  })

  it('preserves a TZID local event when importing', () => {
    const events = parseIcsEvents([
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:ny-1',
      'DTSTART;TZID=America/New_York:20260115T080000',
      'DTEND;TZID=America/New_York:20260115T090000',
      'SUMMARY:Réunion locale',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n'))

    expect(events[0]).toMatchObject({
      startsAt: '2026-01-15T13:00:00.000Z',
      endsAt: '2026-01-15T14:00:00.000Z',
    })
  })

  it('exports event titles with ICS escaping', () => {
    const ics = plannerEventsToIcs([{
      id: 'task-1',
      entityType: 'calendar',
      title: 'Réunion, équipe; projet',
      date: '2026-09-28',
      day: 0,
      startMin: 8 * 60,
      durationMin: 60,
      category: 'neutral',
      kind: 'fixed',
      locked: true,
    }])

    expect(ics).toContain('SUMMARY:Réunion\\, équipe\\; projet')
    expect(ics).toContain('DTSTART:20260928T080000Z')
    expect(ics).toContain('DTEND:20260928T090000Z')
  })
})
