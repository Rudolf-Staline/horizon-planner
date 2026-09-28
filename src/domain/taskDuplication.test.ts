import { describe, expect, it } from 'vitest'
import { duplicateTask } from './taskDuplication'
import type { PlannerEvent } from './types'

const task: PlannerEvent = {
  id: 'task-original',
  entityType: 'task',
  taskId: 'task-original',
  title: 'Préparer le dossier',
  notes: 'Garder le contexte',
  date: '2026-09-28',
  day: 0,
  startMin: 9 * 60,
  durationMin: 60,
  category: 'project',
  priority: 'high',
  kind: 'flexible',
  deadlineDate: '2026-10-02',
  deadlineDay: 4,
  completed: true,
}

describe('task duplication', () => {
  it('copies task content with a new identity and an available slot', () => {
    const result = duplicateTask(
      task,
      [task],
      [task],
      '2026-09-28',
      {
        startMin: 7 * 60,
        endMin: 18 * 60,
        activeDays: [0, 1, 2, 3, 4],
        bufferMin: 0,
        planningStepMin: 15,
        focusBlockMin: 90,
      },
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const copy = result.events.find(
      (event) => event.id === result.selectedId,
    )
    expect(copy).toBeDefined()
    expect(copy?.id).not.toBe(task.id)
    expect(copy?.taskId).not.toBe(task.taskId)
    expect(copy?.title).toBe(task.title)
    expect(copy?.notes).toBe(task.notes)
    expect(copy?.completed).toBe(false)
    expect(copy?.locked).toBe(false)
    expect(
      `${copy?.date}:${copy?.startMin}`,
    ).not.toBe(`${task.date}:${task.startMin}`)
  })

  it('does not duplicate an expired deadline', () => {
    const overdueTask = {
      ...task,
      completed: false,
      deadlineDate: '2026-09-27',
      deadlineDay: 6,
    }
    const result = duplicateTask(
      overdueTask,
      [overdueTask],
      [overdueTask],
      '2026-09-28',
      {
        startMin: 7 * 60,
        endMin: 18 * 60,
        activeDays: [0, 1, 2, 3, 4],
        bufferMin: 0,
        planningStepMin: 15,
        focusBlockMin: 90,
      },
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events.at(-1)?.deadlineDate).toBeUndefined()
  })

  it('does not schedule a new copy in a time slot that has already passed', () => {
    const result = duplicateTask(
      task,
      [task],
      [task],
      '2026-09-28',
      {
        startMin: 7 * 60,
        endMin: 18 * 60,
        activeDays: [0, 1, 2, 3, 4],
        bufferMin: 0,
        planningStepMin: 15,
      },
      10 * 60 + 7,
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const copy = result.events.at(-1)!
    expect(
      copy.date === '2026-09-28'
        ? copy.startMin >= 10 * 60 + 15
        : copy.date! > '2026-09-28',
    ).toBe(true)
  })

  it('preserves fixed tasks as fixed, in one block', () => {
    const fixed = {
      ...task,
      kind: 'fixed' as const,
      splittable: true,
    }
    const result = duplicateTask(
      fixed,
      [fixed],
      [fixed],
      '2026-09-28',
      {
        startMin: 7 * 60,
        endMin: 18 * 60,
        activeDays: [0, 1, 2, 3, 4],
        bufferMin: 0,
        planningStepMin: 15,
      },
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toHaveLength(2)
    expect(result.events[1].kind).toBe('fixed')
    expect(result.events[1].segmentCount).toBe(1)
  })

  it('searches the next week when a task has no deadline on Sunday', () => {
    const sunday = {
      ...task,
      id: 'sunday-task',
      taskId: 'sunday-task',
      date: '2026-09-27',
      day: 6,
      deadlineDate: undefined,
      deadlineDay: undefined,
    }
    const result = duplicateTask(
      sunday,
      [sunday],
      [sunday],
      '2026-09-27',
      {
        startMin: 7 * 60,
        endMin: 18 * 60,
        activeDays: [0, 1, 2, 3, 4],
        bufferMin: 0,
        planningStepMin: 15,
      },
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events[1].date).toBe('2026-09-28')
    expect(result.events[1].deadlineDate).toBeUndefined()
  })
})
