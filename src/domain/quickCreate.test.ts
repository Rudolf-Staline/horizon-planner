import {
  describe,
  expect,
  it,
} from 'vitest'
import { buildInlineTask, buildRepeatedTasks, repeatedDates } from './quickCreate'

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

describe('multiple-day quick create', () => {
  it('selects dates across a month boundary and rejects oversized ranges', () => {
    expect(repeatedDates('2026-09-28', '2026-10-04', [0, 2, 4]))
      .toEqual(['2026-09-28', '2026-09-30', '2026-10-02'])
    expect(repeatedDates('2026-09-01', '2026-10-02', [0])).toEqual([])
  })
  it('creates independent fixed tasks at the same hour', () => {
    let count = 0
    const tasks = buildRepeatedTasks(
      ['2026-09-28', '2026-09-30'], ' Réviser EDP ', 840, 225, 'focus',
      () => `task-${++count}`,
    )
    expect(tasks.map((task) => task.taskId)).toEqual(['task-1', 'task-2'])
    expect(tasks.map((task) => task.day)).toEqual([0, 2])
    expect(tasks.every((task) => task.kind === 'fixed' &&
      task.title === 'Réviser EDP' && task.startMin === 840 &&
      task.durationMin === 225 && task.segmentCount === 1)).toBe(true)
  })
})
