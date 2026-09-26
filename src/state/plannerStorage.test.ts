import { describe, expect, it } from 'vitest'
import type { PlannerEvent } from '../domain/types'
import {
  LEGACY_STORAGE_KEY,
  parseLocalPlannerEnvelope,
  plannerStorageKey,
  serializeLocalPlannerEnvelope,
} from './plannerStorage'

const event: PlannerEvent = {
  id: 'task-a',
  entityType: 'task',
  taskId: 'task-a',
  segmentIndex: 0,
  segmentCount: 1,
  title: 'Task',
  date: '2026-09-26',
  day: 5,
  startMin: 600,
  durationMin: 60,
  category: 'focus',
  kind: 'flexible',
}

describe('planner local storage contract', () => {
  it('scopes cache keys by authenticated user', () => {
    expect(
      plannerStorageKey('user-a'),
    ).not.toBe(
      plannerStorageKey('user-b'),
    )

    expect(
      plannerStorageKey('user-a'),
    ).toBe(
      'horizon-planner-v2:user-a',
    )
  })

  it('keeps the legacy key separate from user caches', () => {
    expect(
      plannerStorageKey('horizon-planner-v1'),
    ).not.toBe(
      LEGACY_STORAGE_KEY,
    )
  })

  it('round-trips a valid envelope', () => {
    const raw =
      serializeLocalPlannerEnvelope(
        [event],
        1234,
      )
    const parsed =
      parseLocalPlannerEnvelope(raw)

    expect(parsed).toEqual({
      schemaVersion: 2,
      events: [event],
      modifiedAt: 1234,
    })
  })

  it('rejects malformed or wrong-version data', () => {
    expect(
      parseLocalPlannerEnvelope(
        '{bad json',
      ),
    ).toBeNull()

    expect(
      parseLocalPlannerEnvelope(
        JSON.stringify({
          schemaVersion: 1,
          events: [event],
          modifiedAt: 1,
        }),
      ),
    ).toBeNull()

    expect(
      parseLocalPlannerEnvelope(
        JSON.stringify({
          schemaVersion: 2,
          events: {},
          modifiedAt: 1,
        }),
      ),
    ).toBeNull()

    expect(
      parseLocalPlannerEnvelope(
        JSON.stringify({
          schemaVersion: 2,
          events: [],
          modifiedAt: 'later',
        }),
      ),
    ).toBeNull()
  })
})
