import { describe, expect, it } from 'vitest'
import {
  baseTaskTitle,
  groupTaskEvents,
  isCalendarEntity,
  logicalTaskId,
} from './taskIdentity'
import type { PlannerEvent } from './types'

const segment = (
  id: string,
  taskId: string,
  index: number,
): PlannerEvent => ({
  id,
  taskId,
  segmentIndex: index,
  segmentCount: 2,
  entityType: 'task',
  title: 'Rapport',
  date: '2026-09-26',
  day: 5,
  startMin: 9 * 60 + index * 120,
  durationMin: 60,
  category: 'focus',
  kind: 'flexible',
})

describe('planner task identity', () => {
  it('groups multiple calendar segments under one logical task', () => {
    const groups = groupTaskEvents([
      segment('segment-b', 'task-a', 1),
      segment('segment-a', 'task-a', 0),
    ])

    expect(groups.size).toBe(1)
    expect(groups.get('task-a')?.map((item) => item.id)).toEqual([
      'segment-a',
      'segment-b',
    ])
  })

  it('keeps explicit tasks distinct from locked calendar events', () => {
    const task: PlannerEvent = {
      ...segment('task-segment', 'task-x', 0),
      kind: 'fixed',
      locked: true,
      entityType: 'task',
    }

    const calendar: PlannerEvent = {
      id: 'calendar-x',
      entityType: 'calendar',
      title: 'Cours',
      date: '2026-09-26',
      day: 5,
      startMin: 600,
      durationMin: 60,
      category: 'course',
      kind: 'fixed',
      locked: true,
    }

    expect(isCalendarEntity(task)).toBe(false)
    expect(isCalendarEntity(calendar)).toBe(true)
    expect(logicalTaskId(task)).toBe('task-x')
  })

  it('removes the old visual split suffix from persisted task titles', () => {
    expect(baseTaskTitle('Rapport · 2/3')).toBe('Rapport')
    expect(baseTaskTitle('Rapport')).toBe('Rapport')
  })
})
