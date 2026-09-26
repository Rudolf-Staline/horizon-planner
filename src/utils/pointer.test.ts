import { describe, expect, it } from 'vitest'
import {
  calendarGesturePatch,
  edgeScrollDelta,
  type CalendarGestureOrigin,
} from './pointer'

const origin = (
  patch:
    Partial<CalendarGestureOrigin> = {},
): CalendarGestureOrigin => ({
  mode: 'move',
  startX: 100,
  startY: 100,
  originalDay: 2,
  originalStart: 9 * 60,
  originalDuration: 60,
  originalScrollTop: 0,
  originalScrollLeft: 0,
  ...patch,
})

describe('calendarGesturePatch', () => {
  it('snaps vertical movement to 15-minute increments', () => {
    const patch =
      calendarGesturePatch(
        origin(),
        {
          clientX: 100,
          clientY: 126,
          scrollTop: 0,
          scrollLeft: 0,
        },
        154,
        6,
      )

    expect(
      patch.startMin,
    ).toBe(9 * 60 + 15)
  })

  it('moves across day columns', () => {
    const patch =
      calendarGesturePatch(
        origin(),
        {
          clientX: 100 + 154,
          clientY: 100,
          scrollTop: 0,
          scrollLeft: 0,
        },
        154,
        6,
      )

    expect(patch.day).toBe(3)
    expect(patch.startMin).toBe(
      9 * 60,
    )
  })

  it('includes accumulated vertical scroll in the gesture', () => {
    const patch =
      calendarGesturePatch(
        origin(),
        {
          clientX: 100,
          clientY: 100,
          scrollTop: 48,
          scrollLeft: 0,
        },
        154,
        6,
      )

    expect(
      patch.startMin,
    ).toBe(9 * 60 + 30)
  })

  it('includes accumulated horizontal scroll in the day change', () => {
    const patch =
      calendarGesturePatch(
        origin(),
        {
          clientX: 100,
          clientY: 100,
          scrollTop: 0,
          scrollLeft: 154,
        },
        154,
        6,
      )

    expect(patch.day).toBe(3)
  })

  it('clamps movement to calendar bounds', () => {
    const patch =
      calendarGesturePatch(
        origin({
          originalDay: 6,
          originalStart:
            21 * 60,
        }),
        {
          clientX: 1000,
          clientY: 1000,
          scrollTop: 0,
          scrollLeft: 0,
        },
        154,
        6,
      )

    expect(patch.day).toBe(6)
    expect(patch.startMin).toBe(
      21 * 60,
    )
  })

  it('resizes in snapped increments', () => {
    const patch =
      calendarGesturePatch(
        origin({
          mode: 'resize',
        }),
        {
          clientX: 100,
          clientY: 148,
          scrollTop: 0,
          scrollLeft: 0,
        },
        154,
        6,
      )

    expect(
      patch.durationMin,
    ).toBe(90)
  })

  it('never resizes below one slot or beyond 22:00', () => {
    const smaller =
      calendarGesturePatch(
        origin({
          mode: 'resize',
          originalDuration: 30,
        }),
        {
          clientX: 100,
          clientY: -500,
          scrollTop: 0,
          scrollLeft: 0,
        },
        154,
        6,
      )

    const larger =
      calendarGesturePatch(
        origin({
          mode: 'resize',
          originalStart:
            21 * 60,
          originalDuration: 30,
        }),
        {
          clientX: 100,
          clientY: 1000,
          scrollTop: 0,
          scrollLeft: 0,
        },
        154,
        6,
      )

    expect(
      smaller.durationMin,
    ).toBe(15)
    expect(
      larger.durationMin,
    ).toBe(60)
  })
})

describe('edgeScrollDelta', () => {
  it('does nothing in the safe center area', () => {
    expect(
      edgeScrollDelta(
        500,
        100,
        900,
      ),
    ).toBe(0)
  })

  it('scrolls upward near the top edge', () => {
    expect(
      edgeScrollDelta(
        110,
        100,
        900,
      ),
    ).toBeLessThan(0)
  })

  it('scrolls downward near the bottom edge', () => {
    expect(
      edgeScrollDelta(
        890,
        100,
        900,
      ),
    ).toBeGreaterThan(0)
  })

  it('increases magnitude closer to the edge', () => {
    const near =
      Math.abs(
        edgeScrollDelta(
          105,
          100,
          900,
        ),
      )
    const farther =
      Math.abs(
        edgeScrollDelta(
          150,
          100,
          900,
        ),
      )

    expect(near).toBeGreaterThan(
      farther,
    )
  })

  it('returns zero for invalid bounds', () => {
    expect(
      edgeScrollDelta(
        100,
        300,
        200,
      ),
    ).toBe(0)
  })
})
