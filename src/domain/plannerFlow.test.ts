import { describe, expect, it } from 'vitest'
import { parseQuickTask } from './naturalLanguage'
import {
  planFlexibleTask,
} from './scheduling'
import type { PlannerEvent } from './types'

function blocker(
  id: string,
  date: string,
  day: number,
  startMin: number,
  durationMin: number,
): PlannerEvent {
  return {
    id,
    entityType: 'calendar',
    title: 'Indisponible',
    date,
    day,
    startMin,
    durationMin,
    category: 'neutral',
    kind: 'fixed',
    locked: true,
  }
}

describe('planner domain flow', () => {
  it('parses Sunday input and schedules tomorrow across the week boundary', () => {
    const parsed = parseQuickTask(
      'Demain préparer rapport 2h après 9h avant mardi',
      '2026-09-27',
      18 * 60,
    )

    expect(parsed).not.toBeNull()

    const draft: PlannerEvent = {
      id: 'task-a',
      entityType: 'task',
      taskId: 'task-a',
      segmentIndex: 0,
      segmentCount: 1,
      ...parsed!,
    }

    const mondayBlocked = blocker(
      'monday-busy',
      '2026-09-28',
      0,
      9 * 60,
      13 * 60,
    )

    const plan = planFlexibleTask(
      draft,
      [mondayBlocked],
    )

    expect(plan).not.toBeNull()
    expect(plan!.kind).toBe('single')
    expect(
      plan!.placements[0].date,
    ).toBe('2026-09-29')
    expect(
      plan!.placements[0].startMin,
    ).toBeGreaterThanOrEqual(9 * 60)
  })

  it('splits work across concrete dates when no day can hold the whole duration', () => {
    const parsed = parseQuickTask(
      'Lundi préparer rapport 2h avant mardi',
      '2026-09-27',
      9 * 60,
    )

    expect(parsed).not.toBeNull()

    const draft: PlannerEvent = {
      id: 'task-split',
      entityType: 'task',
      taskId: 'task-split',
      segmentIndex: 0,
      segmentCount: 1,
      ...parsed!,
      windowStartMin: 9 * 60,
      windowEndMin: 10 * 60,
      splittable: true,
      minChunkMin: 60,
    }

    const plan = planFlexibleTask(
      draft,
      [],
    )

    expect(plan).not.toBeNull()
    expect(plan!.kind).toBe('split')
    expect(
      plan!.placements.map(
        (placement) =>
          placement.date,
      ),
    ).toEqual([
      '2026-09-28',
      '2026-09-29',
    ])
    expect(
      plan!.placements.map(
        (placement) =>
          placement.durationMin,
      ),
    ).toEqual([60, 60])
  })

  it('never sends fixed natural-language appointments through flexible planning', () => {
    const parsed = parseQuickTask(
      'Réunion mardi à 16h pendant 45 min',
      '2026-09-27',
      9 * 60,
    )

    expect(parsed).not.toBeNull()
    expect(parsed!.kind).toBe('fixed')

    const fixed: PlannerEvent = {
      id: 'meeting',
      entityType: 'calendar',
      ...parsed!,
    }

    expect(
      planFlexibleTask(
        fixed,
        [],
      ),
    ).toBeNull()
  })

  it('keeps scheduling behavior separate from semantic category', () => {
    const parsed = parseQuickTask(
      'Demain appeler famille 30 min',
      '2026-09-27',
      18 * 60,
    )

    expect(parsed).not.toBeNull()
    expect(parsed!.kind).toBe('flexible')
    expect(parsed!.category).toBe('personal')
  })
})
