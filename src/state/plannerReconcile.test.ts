import { describe, expect, it } from 'vitest'
import type { PlannerEvent } from '../domain/types'
import { choosePlannerSource } from './plannerReconcile'

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
