import { describe, expect, it } from 'vitest'
import type { PlannerEvent } from './types'
import {
  isDeadlineOverdue,
  overdueLabel,
  taskOverdueState,
} from './overdue'

const segment = (
  patch: Partial<PlannerEvent> = {},
): PlannerEvent => ({
  id: 'segment-1',
  entityType: 'task',
  taskId: 'task-1',
  title: 'Rapport',
  date: '2026-09-24',
  day: 3,
  startMin: 9 * 60,
  durationMin: 60,
  category: 'project',
  kind: 'flexible',
  deadlineDate: '2026-09-25',
  ...patch,
})

describe('overdue task state', () => {
  it('does not mark a task overdue during its deadline day', () => {
    expect(
      isDeadlineOverdue('2026-09-26', false, '2026-09-26'),
    ).toBe(false)
  })

  it('counts only unfinished duration after the deadline', () => {
    const overdue = taskOverdueState([
      segment({ completed: true }),
      segment({ id: 'segment-2', durationMin: 45 }),
    ], '2026-09-28')

    expect(overdue).toEqual({
      deadlineDate: '2026-09-25',
      days: 3,
      remainingMinutes: 45,
    })
  })

  it('clears overdue state once every segment is completed', () => {
    expect(
      taskOverdueState([
        segment({ completed: true }),
      ], '2026-09-28'),
    ).toBeNull()
  })

  it('uses a singular label for one day', () => {
    expect(overdueLabel(1)).toBe('En retard d’un jour')
  })
})
