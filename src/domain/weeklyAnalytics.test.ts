import {
  describe,
  expect,
  it,
} from 'vitest'
import type {
  PlannerEvent,
} from './types'
import {
  buildWeeklyAnalytics,
} from './weeklyAnalytics'

function event(
  id: string,
  date: string,
  durationMin: number,
  patch:
    Partial<PlannerEvent> = {},
): PlannerEvent {
  return {
    id,
    entityType:
      'task',
    taskId: id,
    segmentIndex: 0,
    segmentCount: 1,
    title: id,
    date,
    day: 0,
    startMin: 9 * 60,
    durationMin,
    category: 'neutral',
    kind: 'flexible',
    ...patch,
  }
}

describe(
  'weekly analytics',
  () => {
    it(
      'counts only active events in the anchor week',
      () => {
        const metrics =
          buildWeeklyAnalytics(
            [
              event(
                'inside',
                '2026-09-21',
                60,
              ),
              event(
                'outside',
                '2026-09-28',
                180,
              ),
              event(
                'done',
                '2026-09-22',
                90,
                {
                  completed:
                    true,
                },
              ),
            ],
            new Date(
              2026,
              8,
              23,
              12,
            ),
          )

        expect(
          metrics.totalMinutes,
        ).toBe(60)
        expect(
          metrics.activeCount,
        ).toBe(1)
      },
    )

    it(
      'uses real ISO dates instead of legacy weekday indices',
      () => {
        const metrics =
          buildWeeklyAnalytics(
            [
              event(
                'wednesday',
                '2026-09-23',
                120,
                {
                  day: 0,
                },
              ),
            ],
            new Date(
              2026,
              8,
              23,
              12,
            ),
          )

        expect(
          metrics.byDay[2],
        ).toMatchObject({
          date:
            '2026-09-23',
          minutes: 120,
        })
        expect(
          metrics.byDay[0]
            .minutes,
        ).toBe(0)
      },
    )

    it(
      'does not invent a busiest day for an empty week',
      () => {
        const metrics =
          buildWeeklyAnalytics(
            [],
            new Date(
              2026,
              8,
              23,
              12,
            ),
          )

        expect(
          metrics.busiest,
        ).toBeNull()
      },
    )
  },
)
