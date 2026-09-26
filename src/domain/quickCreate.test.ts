import {
  describe,
  expect,
  it,
} from 'vitest'
import { buildInlineTask } from './quickCreate'

describe('inline calendar quick create', () => {
  it('creates a neutral flexible task without hidden project semantics', () => {
    const event =
      buildInlineTask(
        {
          date: '2026-09-24',
          day: 3,
          startMin: 14 * 60,
        },
        '  Réviser EDP  ',
        'task-1',
      )

    expect(event).toMatchObject({
      id: 'task-1',
      taskId: 'task-1',
      entityType: 'task',
      title: 'Réviser EDP',
      date: '2026-09-24',
      day: 3,
      startMin: 14 * 60,
      durationMin: 60,
      category: 'neutral',
      priority: 'medium',
      kind: 'flexible',
      segmentIndex: 0,
      segmentCount: 1,
    })
  })

  it('uses a concrete J+2 deadline even across a week boundary', () => {
    const event =
      buildInlineTask(
        {
          date: '2026-09-27',
          day: 6,
          startMin: 18 * 60,
        },
        'Préparer la semaine',
        'task-2',
      )

    expect(
      event.deadlineDate,
    ).toBe('2026-09-29')
    expect(
      event.deadlineDay,
    ).toBe(1)
  })
})
