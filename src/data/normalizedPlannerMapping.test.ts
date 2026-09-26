import {
  describe,
  expect,
  it,
} from 'vitest'
import type {
  PlannerEvent,
} from '../domain/types'
import {
  buildNormalizedPlannerRows,
} from './normalizedPlannerMapping'

const taskSegment = (
  patch:
    Partial<PlannerEvent> = {},
): PlannerEvent => ({
  id: 'segment-1',
  entityType: 'task',
  taskId: 'task-1',
  segmentIndex: 0,
  segmentCount: 2,
  title: 'Rapport',
  date: '2026-09-28',
  day: 0,
  startMin: 9 * 60,
  durationMin: 60,
  category: 'project',
  priority: 'high',
  kind: 'flexible',
  deadlineDate:
    '2026-09-30',
  deadlineDay: 2,
  windowStartMin:
    9 * 60,
  windowEndMin:
    12 * 60,
  energy: 'high',
  splittable: true,
  minChunkMin: 45,
  ...patch,
})

describe('normalized planner mapping', () => {
  it('maps a split task to one task row and multiple segment rows', () => {
    const events = [
      taskSegment({
        completed: true,
      }),
      taskSegment({
        id: 'segment-2',
        segmentIndex: 1,
        date: '2026-09-29',
        day: 1,
        startMin: 10 * 60,
        durationMin: 45,
        completed: true,
      }),
    ]

    const rows =
      buildNormalizedPlannerRows(
        'user-1',
        events,
        new Map([
          [
            'task-1',
            {
              id: 'task-1',
              status:
                'completed',
              completed_at:
                '2026-09-20T12:00:00.000Z',
            },
          ],
        ]),
        () =>
          '2026-09-26T12:00:00.000Z',
      )

    expect(
      rows.taskRows,
    ).toHaveLength(1)
    expect(
      rows.taskRows[0],
    ).toMatchObject({
      id: 'task-1',
      user_id: 'user-1',
      duration_min: 105,
      status: 'completed',
      completed_at:
        '2026-09-20T12:00:00.000Z',
    })

    expect(
      rows.segmentRows,
    ).toHaveLength(2)
    expect(
      rows.segmentRows.map(
        (row) =>
          row.task_id,
      ),
    ).toEqual([
      'task-1',
      'task-1',
    ])
    expect(
      rows.segmentRows.map(
        (row) =>
          row.segment_index,
      ),
    ).toEqual([0, 1])
  })

  it('writes one flexible constraint row for the logical task', () => {
    const rows =
      buildNormalizedPlannerRows(
        'user-1',
        [
          taskSegment(),
          taskSegment({
            id: 'segment-2',
            segmentIndex: 1,
            date:
              '2026-09-29',
            day: 1,
          }),
        ],
        new Map(),
      )

    expect(
      rows.constraintRows,
    ).toEqual([
      expect.objectContaining({
        task_id: 'task-1',
        user_id: 'user-1',
        earliest_date:
          '2026-09-28',
        deadline_date:
          '2026-09-30',
        window_start:
          '09:00:00',
        window_end:
          '12:00:00',
        energy: 'high',
        splittable: true,
        min_chunk_min: 45,
      }),
    ])
  })

  it('keeps manual calendar events outside task tables', () => {
    const meeting:
      PlannerEvent = {
        id: 'meeting',
        entityType:
          'calendar',
        title:
          'Réunion',
        date:
          '2026-09-28',
        day: 0,
        startMin:
          14 * 60,
        durationMin: 60,
        category:
          'admin',
        kind: 'fixed',
        locked: true,
      }

    const rows =
      buildNormalizedPlannerRows(
        'user-1',
        [meeting],
        new Map(),
      )

    expect(
      rows.taskRows,
    ).toEqual([])
    expect(
      rows.segmentRows,
    ).toEqual([])
    expect(
      rows.calendarRows,
    ).toHaveLength(1)
    expect(
      rows.calendarRows[0],
    ).toMatchObject({
      id: 'meeting',
      user_id: 'user-1',
      source: 'manual',
      locked: true,
    })
  })

  it('excludes virtual routine occurrences from persistence projection', () => {
    const routine:
      PlannerEvent = {
        id: 'routine:date',
        entityType:
          'routine',
        routineId:
          'routine-1',
        virtual: true,
        title: 'Sport',
        date:
          '2026-09-28',
        day: 0,
        startMin:
          18 * 60,
        durationMin: 60,
        category:
          'routine',
        kind:
          'fixed',
      }

    const rows =
      buildNormalizedPlannerRows(
        'user-1',
        [routine],
        new Map(),
      )

    expect(
      rows.taskRows,
    ).toEqual([])
    expect(
      rows.segmentRows,
    ).toEqual([])
    expect(
      rows.calendarRows,
    ).toEqual([])
  })

  it('marks fixed task ids for stale constraint cleanup', () => {
    const fixedTask =
      taskSegment({
        taskId:
          'task-fixed',
        id: 'fixed-segment',
        segmentCount: 1,
        kind: 'fixed',
        locked: false,
      })

    const rows =
      buildNormalizedPlannerRows(
        'user-1',
        [fixedTask],
        new Map(),
      )

    expect(
      rows.fixedTaskIds,
    ).toEqual([
      'task-fixed',
    ])
    expect(
      rows.constraintRows,
    ).toEqual([])
  })

  it('does not complete a logical task until every segment is completed', () => {
    const rows =
      buildNormalizedPlannerRows(
        'user-1',
        [
          taskSegment({
            completed: true,
          }),
          taskSegment({
            id: 'segment-2',
            segmentIndex: 1,
            completed: false,
          }),
        ],
        new Map(),
        () =>
          '2026-09-26T12:00:00.000Z',
      )

    expect(
      rows.taskRows[0],
    ).toMatchObject({
      status: 'planned',
      completed_at: null,
    })
  })
})
