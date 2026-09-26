import { describe, expect, it } from 'vitest'
import {
  expandRoutines,
  type Routine,
  type RoutineException,
} from './routines'

const routine: Routine = {
  id: '11111111-1111-4111-8111-111111111111',
  projectId: null,
  title: 'Sport',
  category: 'routine',
  durationMin: 45,
  days: [0],
  preferredStart: '08:00:00',
  active: true,
}

describe('routine exceptions', () => {
  it('skips one occurrence without changing the series', () => {
    const exceptions: RoutineException[] = [
      {
        id: '22222222-2222-4222-8222-222222222222',
        routineId: routine.id,
        occursOn: '2026-09-28',
        action: 'skip',
        overrideStart: null,
        overrideDurationMin: null,
      },
    ]

    const events = expandRoutines(
      [routine],
      '2026-09-28',
      '2026-10-05',
      exceptions,
    )

    expect(
      events.map((event) => event.date),
    ).toEqual(['2026-10-05'])
  })

  it('overrides time and duration for only one occurrence', () => {
    const exceptions: RoutineException[] = [
      {
        id: '33333333-3333-4333-8333-333333333333',
        routineId: routine.id,
        occursOn: '2026-09-28',
        action: 'override',
        overrideStart: '19:15:00',
        overrideDurationMin: 90,
      },
    ]

    const events = expandRoutines(
      [routine],
      '2026-09-28',
      '2026-10-05',
      exceptions,
    )

    expect(events[0]).toMatchObject({
      date: '2026-09-28',
      startMin: 19 * 60 + 15,
      durationMin: 90,
    })
    expect(events[1]).toMatchObject({
      date: '2026-10-05',
      startMin: 8 * 60,
      durationMin: 45,
    })
  })
})
