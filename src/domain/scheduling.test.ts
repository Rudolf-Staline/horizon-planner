import { describe, expect, it } from 'vitest'
import {
  conflictsFor,
  findBestPlacement,
  overlaps,
  planFlexibleTask,
} from './scheduling'
import type { PlannerEvent } from './types'

const base = (patch: Partial<PlannerEvent> = {}): PlannerEvent => ({
  id: 'task',
  title: 'Task',
  day: 0,
  startMin: 9 * 60,
  durationMin: 60,
  category: 'focus',
  kind: 'flexible',
  ...patch,
})

describe('scheduling primitives', () => {
  it('detects overlaps only on the same concrete date', () => {
    expect(overlaps(base({ date: '2026-09-21' }), base({ id: 'b', date: '2026-09-21', startMin: 9 * 60 + 30 }))).toBe(true)
    expect(overlaps(base({ date: '2026-09-21' }), base({ id: 'b', date: '2026-09-28', day: 0 }))).toBe(false)
    expect(overlaps(base(), base({ id: 'b', day: 1 }))).toBe(false)
    expect(overlaps(base(), base({ id: 'b', startMin: 10 * 60 }))).toBe(false)
  })

  it('excludes the event itself from conflict detection', () => {
    const event = base()
    expect(conflictsFor(event, [event])).toEqual([])
  })
})

describe('constraint placement', () => {
  it('respects the scheduling window', () => {
    const event = base({
      startMin: 8 * 60,
      windowStartMin: 13 * 60,
      windowEndMin: 16 * 60,
    })

    const placement = findBestPlacement(event, [])
    expect(placement).not.toBeNull()
    expect(placement!.startMin).toBeGreaterThanOrEqual(13 * 60)
    expect(placement!.startMin + placement!.durationMin).toBeLessThanOrEqual(16 * 60)
  })

  it('uses the user planning bounds and step', () => {
    const event = base({
      startMin: 8 * 60,
      durationMin: 60,
      deadlineDay: 0,
    })

    const placement = findBestPlacement(event, [], {
      startMin: 11 * 60,
      endMin: 13 * 60,
      planningStepMin: 30,
    })

    expect(placement).not.toBeNull()
    expect(placement!.startMin).toBe(11 * 60)
  })

  it('does not plan beyond the deadline day', () => {
    const blockers: PlannerEvent[] = [
      base({ id: 'block-0', day: 0, startMin: 7 * 60, durationMin: 15 * 60, kind: 'fixed' }),
      base({ id: 'block-1', day: 1, startMin: 7 * 60, durationMin: 15 * 60, kind: 'fixed' }),
    ]
    const event = base({ deadlineDay: 1 })
    expect(findBestPlacement(event, blockers)).toBeNull()
  })

  it('never auto-places a fixed event', () => {
    const event = base({ kind: 'fixed' })
    expect(findBestPlacement(event, [])).toBeNull()
  })

  it('avoids occupied slots', () => {
    const event = base({ windowStartMin: 9 * 60, windowEndMin: 12 * 60 })
    const blocker = base({ id: 'block', kind: 'fixed', startMin: 9 * 60, durationMin: 60 })
    const placement = findBestPlacement(event, [blocker])

    expect(placement).not.toBeNull()
    expect(placement!.startMin).toBeGreaterThanOrEqual(10 * 60)
  })

  it('splits a long task when no contiguous slot fits', () => {
    const event = base({
      durationMin: 120,
      splittable: true,
      minChunkMin: 45,
      windowStartMin: 9 * 60,
      windowEndMin: 12 * 60,
      deadlineDay: 0,
    })

    const blocker = base({
      id: 'block',
      kind: 'fixed',
      startMin: 10 * 60,
      durationMin: 60,
    })

    const plan = planFlexibleTask(event, [blocker])
    expect(plan?.kind).toBe('split')
    expect(plan?.placements.reduce((sum, p) => sum + p.durationMin, 0)).toBe(120)
  })
})


describe('date-aware placement', () => {
  it('crosses a week boundary when the concrete deadline allows it', () => {
    const event = base({
      date: '2026-09-27',
      day: 6,
      deadlineDate: '2026-09-28',
      deadlineDay: 0,
      windowStartMin: 9 * 60,
      windowEndMin: 10 * 60,
    })

    const sundayBlocker = base({
      id: 'sunday',
      date: '2026-09-27',
      day: 6,
      kind: 'fixed',
      startMin: 9 * 60,
      durationMin: 60,
    })

    const placement = findBestPlacement(
      event,
      [sundayBlocker],
    )

    expect(placement).not.toBeNull()
    expect(placement!.date).toBe('2026-09-28')
    expect(placement!.day).toBe(0)
  })

  it('rejects a concrete deadline earlier than the task date', () => {
    const event = base({
      date: '2026-09-28',
      day: 0,
      deadlineDate: '2026-09-27',
      deadlineDay: 6,
    })

    expect(
      findBestPlacement(event, []),
    ).toBeNull()
  })
})
