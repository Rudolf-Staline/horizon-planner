import { describe, expect, it } from 'vitest'
import type { PlannerEvent } from './types'
import { proposeConflictReplan } from './replanning'
import { overlaps } from './scheduling'

const fixed = (
  id: string,
  startMin: number,
  overrides: Partial<PlannerEvent> = {},
): PlannerEvent => ({
  id,
  entityType: 'calendar',
  title: id,
  date: '2026-09-28',
  day: 0,
  startMin,
  durationMin: 60,
  category: 'admin',
  kind: 'fixed',
  locked: true,
  ...overrides,
})

const flexible = (
  id: string,
  startMin: number,
  overrides: Partial<PlannerEvent> = {},
): PlannerEvent => ({
  id,
  entityType: 'task',
  taskId: id,
  segmentIndex: 0,
  segmentCount: 1,
  title: id,
  date: '2026-09-28',
  day: 0,
  startMin,
  durationMin: 60,
  category: 'focus',
  kind: 'flexible',
  deadlineDate: '2026-09-29',
  deadlineDay: 1,
  windowStartMin: 9 * 60,
  windowEndMin: 18 * 60,
  ...overrides,
})

describe('adaptive conflict replan', () => {
  it('moves the current flexible task when it conflicts with a fixed event', () => {
    const task =
      flexible('focus', 10 * 60)
    const meeting =
      fixed('meeting', 10 * 60)

    const proposal =
      proposeConflictReplan(
        task,
        [task, meeting],
      )

    expect(proposal).not.toBeNull()
    expect(proposal!.eventId).toBe('focus')
    expect(proposal!.reason).toBe(
      'move-current-flexible',
    )

    const moved = {
      ...task,
      date: proposal!.date,
      day: proposal!.day,
      startMin:
        proposal!.startMin,
    }

    expect(
      overlaps(
        moved,
        meeting,
      ),
    ).toBe(false)
  })

  it('keeps a fixed event in place and proposes moving its single flexible conflict', () => {
    const meeting =
      fixed('meeting', 10 * 60)
    const task =
      flexible('focus', 10 * 60)

    const proposal =
      proposeConflictReplan(
        meeting,
        [meeting, task],
      )

    expect(proposal).not.toBeNull()
    expect(proposal!.eventId).toBe('focus')
    expect(proposal!.eventTitle).toBe('focus')
    expect(proposal!.reason).toBe(
      'move-conflicting-flexible',
    )
  })

  it('does not propose a move for a fixed versus fixed conflict', () => {
    const first =
      fixed('a', 10 * 60)
    const second =
      fixed('b', 10 * 60)

    expect(
      proposeConflictReplan(
        first,
        [first, second],
      ),
    ).toBeNull()
  })

  it('does not arbitrarily choose among several flexible conflicts', () => {
    const meeting =
      fixed('meeting', 10 * 60)
    const first =
      flexible('a', 10 * 60)
    const second =
      flexible('b', 10 * 60, {
        durationMin: 30,
      })

    expect(
      proposeConflictReplan(
        meeting,
        [
          meeting,
          first,
          second,
        ],
      ),
    ).toBeNull()
  })

  it('does not move a locked flexible task', () => {
    const meeting =
      fixed('meeting', 10 * 60)
    const task =
      flexible('focus', 10 * 60, {
        locked: true,
      })

    expect(
      proposeConflictReplan(
        meeting,
        [meeting, task],
      ),
    ).toBeNull()
  })
})
