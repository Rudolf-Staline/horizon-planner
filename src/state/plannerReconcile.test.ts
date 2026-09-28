import { describe, expect, it } from 'vitest'
import type { PlannerEvent } from '../domain/types'
import {
  cacheAfterReset,
  choosePlannerSource,
  plannerReconcileMode,
  showsPlannerLoading,
} from './plannerReconcile'

const event = (id: string): PlannerEvent => ({
  id,
  entityType: 'task',
  taskId: id,
  segmentIndex: 0,
  segmentCount: 1,
  title: id,
  date: '2026-09-26',
  day: 5,
  startMin: 600,
  durationMin: 60,
  category: 'focus',
  kind: 'flexible',
})

describe('planner reconciliation', () => {
  it('prefers normalized cloud data when it is at least as recent', () => {
    const choice = choosePlannerSource({
      normalized: {
        events: [event('cloud')],
        modifiedAt: 200,
      },
      local: {
        events: [event('local')],
        modifiedAt: 100,
      },
      now: 300,
    })

    expect(choice.source).toBe('normalized')
    expect(choice.events[0].id).toBe('cloud')
    expect(choice.shouldPush).toBe(false)
  })

  it('keeps newer local changes and schedules a normalized push', () => {
    const choice = choosePlannerSource({
      normalized: {
        events: [event('cloud')],
        modifiedAt: 100,
      },
      local: {
        events: [event('local')],
        modifiedAt: 200,
      },
      now: 300,
    })

    expect(choice.source).toBe('local')
    expect(choice.events[0].id).toBe('local')
    expect(choice.shouldPush).toBe(true)
  })

  it('never overwrites cloud data after a normalized read failure', () => {
    const choice = choosePlannerSource({
      normalized: null,
      local: {
        events: [event('local')],
        modifiedAt: 200,
      },
      normalizedReadFailed: true,
      now: 300,
    })

    expect(choice.source).toBe('local')
    expect(choice.shouldPush).toBe(false)
  })

  it('starts empty for a new account without planner data', () => {
    const choice = choosePlannerSource({
      normalized: null,
      local: null,
      now: 300,
    })

    expect(choice).toMatchObject({
      source: 'empty',
      modifiedAt: 300,
      shouldPush: false,
      events: [],
    })
  })
})


describe('planner reconciliation edge cases', () => {
  it('does not restore deleted cloud rows from a cache created before a reset', () => {
    const cached = { events: [event('deleted')], modifiedAt: 100 }
    const choice = choosePlannerSource({
      normalized: null,
      local: cacheAfterReset(cached, 200),
      now: 300,
    })
    expect(choice.events).toEqual([])
    expect(choice.shouldPush).toBe(false)
    expect(cacheAfterReset({ ...cached, modifiedAt: 250 }, 200)).toEqual({
      ...cached, modifiedAt: 250,
    })
  })
  it('uses normalized data on equal timestamps to avoid a redundant push', () => {
    const choice = choosePlannerSource({
      normalized: {
        events: [event('cloud')],
        modifiedAt: 200,
      },
      local: {
        events: [event('local')],
        modifiedAt: 200,
      },
      now: 300,
    })

    expect(choice.source).toBe('normalized')
    expect(choice.events[0].id).toBe('cloud')
    expect(choice.shouldPush).toBe(false)
  })

  it('pushes a local-only cache after a successful empty cloud read', () => {
    const choice = choosePlannerSource({
      normalized: null,
      local: {
        events: [event('local')],
        modifiedAt: 200,
      },
      now: 300,
    })

    expect(choice.source).toBe('local')
    expect(choice.shouldPush).toBe(true)
  })

  it('does not invent a push when cloud read fails and no local cache exists', () => {
    const choice = choosePlannerSource({
      normalized: null,
      local: null,
      normalizedReadFailed: true,
      now: 300,
    })

    expect(choice).toMatchObject({
      source: 'empty',
      events: [],
      shouldPush: false,
      modifiedAt: 300,
    })
  })
})

describe('planner refresh presentation', () => {
  it('keeps the planner mounted when the current session refreshes', () => {
    const mode = plannerReconcileMode(
      'user-1',
      'user-1',
    )

    expect(mode).toBe('background')
    expect(showsPlannerLoading(mode)).toBe(false)
  })

  it('shows the loading gate for the first authenticated session', () => {
    const mode = plannerReconcileMode(
      null,
      'user-1',
    )

    expect(mode).toBe('initial')
    expect(showsPlannerLoading(mode)).toBe(true)
  })
})
