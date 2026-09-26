import { describe, expect, it } from 'vitest'
import type { PlannerEvent } from './types'
import {
  deleteLogicalTask,
  deletePlannerEvent,
  toggleLogicalTaskCompleted,
} from './taskMutations'

const segment = (
  id: string,
  index: number,
  overrides: Partial<PlannerEvent> = {},
): PlannerEvent => ({
  id,
  entityType: 'task',
  taskId: 'task-a',
  segmentIndex: index,
  segmentCount: 3,
  title: 'Rapport',
  date:
    index === 2
      ? '2026-09-29'
      : '2026-09-28',
  day:
    index === 2 ? 1 : 0,
  startMin:
    9 * 60 + index * 60,
  durationMin: 60,
  category: 'project',
  kind: 'flexible',
  ...overrides,
})

describe('task mutations', () => {
  it('completes every segment of a logical task together', () => {
    const events = [
      segment('a', 0, {
        completed: true,
      }),
      segment('b', 1),
      segment('c', 2),
    ]

    const next =
      toggleLogicalTaskCompleted(
        events,
        'b',
      )

    expect(
      next
        .filter(
          (event) =>
            event.taskId ===
            'task-a',
        )
        .every(
          (event) =>
            event.completed,
        ),
    ).toBe(true)
  })

  it('reopens every segment when the whole task is already complete', () => {
    const events = [
      segment('a', 0, {
        completed: true,
      }),
      segment('b', 1, {
        completed: true,
      }),
      segment('c', 2, {
        completed: true,
      }),
    ]

    const next =
      toggleLogicalTaskCompleted(
        events,
        'a',
      )

    expect(
      next.every(
        (event) =>
          !event.completed,
      ),
    ).toBe(true)
  })

  it('toggles a non-task event without touching anything else', () => {
    const calendar: PlannerEvent = {
      id: 'meeting',
      entityType: 'calendar',
      title: 'Réunion',
      date: '2026-09-28',
      day: 0,
      startMin: 14 * 60,
      durationMin: 60,
      category: 'admin',
      kind: 'fixed',
      locked: true,
    }

    const task = segment(
      'a',
      0,
    )
    const next =
      toggleLogicalTaskCompleted(
        [calendar, task],
        'meeting',
      )

    expect(
      next[0].completed,
    ).toBe(true)
    expect(
      next[1].completed,
    ).toBeUndefined()
  })

  it('deletes one segment and reindexes the remaining task chronologically', () => {
    const unrelated = segment(
      'other',
      0,
      {
        taskId: 'task-b',
        segmentCount: 1,
      },
    )

    const next =
      deletePlannerEvent(
        [
          segment('c', 2),
          unrelated,
          segment('a', 0),
          segment('b', 1),
        ],
        'b',
      )

    const remaining =
      next.filter(
        (event) =>
          event.taskId ===
          'task-a',
      )

    expect(
      remaining.map(
        (event) => event.id,
      ),
    ).toEqual(['c', 'a'])

    const byIndex =
      [...remaining].sort(
        (a, b) =>
          (a.segmentIndex ?? 0) -
          (b.segmentIndex ?? 0),
      )

    expect(
      byIndex.map(
        (event) => ({
          id: event.id,
          index:
            event.segmentIndex,
          count:
            event.segmentCount,
        }),
      ),
    ).toEqual([
      {
        id: 'a',
        index: 0,
        count: 2,
      },
      {
        id: 'c',
        index: 1,
        count: 2,
      },
    ])

    expect(
      next.find(
        (event) =>
          event.id === 'other',
      )?.segmentCount,
    ).toBe(1)
  })

  it('deletes every segment of one logical task and reports removed ids', () => {
    const unrelated = segment(
      'other',
      0,
      {
        taskId: 'task-b',
        segmentCount: 1,
      },
    )

    const result =
      deleteLogicalTask(
        [
          segment('a', 0),
          segment('b', 1),
          unrelated,
        ],
        'b',
      )

    expect(
      result.events.map(
        (event) => event.id,
      ),
    ).toEqual(['other'])

    expect(
      [...result.removedIds].sort(),
    ).toEqual(['a', 'b'])
  })

  it('leaves state untouched when the target id does not exist', () => {
    const events = [
      segment('a', 0),
    ]

    expect(
      deletePlannerEvent(
        events,
        'missing',
      ),
    ).toBe(events)

    const deletion =
      deleteLogicalTask(
        events,
        'missing',
      )

    expect(
      deletion.events,
    ).toBe(events)
    expect(
      deletion.removedIds.size,
    ).toBe(0)
  })
})
