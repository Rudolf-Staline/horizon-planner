import { describe, expect, it } from 'vitest'
import type { PlannerEvent } from './types'
import { layoutCalendarLanes } from './calendarLayout'

const item = (
  id: string,
  startMin: number,
  durationMin: number,
  date = '2026-09-28',
): PlannerEvent => ({
  id,
  title: id,
  date,
  day: 0,
  startMin,
  durationMin,
  category: 'focus',
  kind: 'fixed',
})

describe('calendar overlap lanes', () => {
  it('keeps non-overlapping events full width', () => {
    const layout = layoutCalendarLanes([
      item('a', 9 * 60, 60),
      item('b', 10 * 60, 60),
    ])

    expect(layout.get('a')).toEqual({
      lane: 0,
      laneCount: 1,
    })
    expect(layout.get('b')).toEqual({
      lane: 0,
      laneCount: 1,
    })
  })

  it('places simultaneous events in distinct lanes', () => {
    const layout = layoutCalendarLanes([
      item('a', 9 * 60, 60),
      item('b', 9 * 60, 60),
      item('c', 9 * 60, 60),
    ])

    expect(
      new Set([
        layout.get('a')?.lane,
        layout.get('b')?.lane,
        layout.get('c')?.lane,
      ]).size,
    ).toBe(3)

    expect(layout.get('a')?.laneCount).toBe(3)
    expect(layout.get('b')?.laneCount).toBe(3)
    expect(layout.get('c')?.laneCount).toBe(3)
  })

  it('reuses a lane inside a connected overlap chain', () => {
    const layout = layoutCalendarLanes([
      item('a', 9 * 60, 60),
      item('b', 9 * 60 + 30, 60),
      item('c', 10 * 60, 60),
    ])

    expect(layout.get('a')).toEqual({
      lane: 0,
      laneCount: 2,
    })
    expect(layout.get('b')).toEqual({
      lane: 1,
      laneCount: 2,
    })
    expect(layout.get('c')).toEqual({
      lane: 0,
      laneCount: 2,
    })
  })

  it('never mixes events from different dates', () => {
    const layout = layoutCalendarLanes([
      item('a', 9 * 60, 60, '2026-09-28'),
      item('b', 9 * 60, 60, '2026-09-29'),
    ])

    expect(layout.get('a')?.laneCount).toBe(1)
    expect(layout.get('b')?.laneCount).toBe(1)
  })
})
