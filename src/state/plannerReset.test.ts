import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PLANNER_PREFERENCES } from '../domain/preferences'
import { plannerStorageKey, serializeLocalPlannerEnvelope } from './plannerStorage'
import type { PlannerEvent } from '../domain/types'

const mocks = vi.hoisted(() => ({
  effects: [] as Array<() => unknown>,
  profile: vi.fn(),
  load: vi.fn(),
  sync: vi.fn(),
  epoch: vi.fn(),
  authCallback: null as null | ((event: string, session: unknown) => void),
}))

vi.mock('react', () => ({
  useState: (initial: unknown) => [typeof initial === 'function' ? initial() : initial, vi.fn()],
  useRef: (current: unknown) => ({ current }),
  useMemo: (compute: () => unknown) => compute(),
  useEffect: (effect: () => unknown) => { mocks.effects.push(effect) },
}))
vi.mock('../data/auth', () => ({ currentCloudUser: async () => ({ id: 'user-1' }) }))
vi.mock('../data/profile', () => ({ loadOwnProfile: mocks.profile, syncProfileTimezone: vi.fn() }))
vi.mock('../data/normalizedPlanner', () => ({
  loadNormalizedPlanner: mocks.load,
  syncNormalizedPlanner: mocks.sync,
}))
vi.mock('../lib/supabase', () => ({
  setPlannerResetEpoch: mocks.epoch,
  supabase: {
    auth: { onAuthStateChange: (callback: typeof mocks.authCallback) => {
      mocks.authCallback = callback
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    } },
    channel: () => {
      const channel = { on: vi.fn(), subscribe: vi.fn() }
      channel.on.mockReturnValue(channel)
      channel.subscribe.mockReturnValue(channel)
      return channel
    },
    removeChannel: vi.fn(),
  },
}))

import { usePlanner } from './planner'

const resetAt = 1790557672175
const event: PlannerEvent = {
  id: 'a8dba062-feb4-4a83-abf0-d794a2fe5fc8',
  taskId: 'a8dba062-feb4-4a83-abf0-d794a2fe5fc8',
  entityType: 'task', title: 'Sport', date: '2026-09-30', day: 2,
  startMin: 600, durationMin: 60, category: 'personal', kind: 'fixed',
}

describe('reset epoch startup integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.effects = []
    mocks.authCallback = null
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    })
    vi.stubGlobal('window', {
      location: { hash: '', search: '' },
      setTimeout, clearTimeout,
    })
    mocks.profile.mockResolvedValue({ dataResetAt: resetAt, preferences: DEFAULT_PLANNER_PREFERENCES })
    mocks.load.mockResolvedValue(null)
    mocks.sync.mockResolvedValue(undefined)
  })

  afterEach(() => vi.unstubAllGlobals())

  async function start() {
    usePlanner()
    const cleanup = mocks.effects[0]() as () => void
    await vi.waitFor(() => expect(JSON.parse(localStorage.getItem(plannerStorageKey('user-1')) ?? '{}').resetAt).toBe(resetAt))
    return cleanup
  }

  it('sets the request epoch before reading cloud data or pushing a matching cache', async () => {
    localStorage.setItem(plannerStorageKey('user-1'), serializeLocalPlannerEnvelope([event], resetAt + 100, resetAt))
    const cleanup = await start()
    await vi.waitFor(() => expect(mocks.sync).toHaveBeenCalledWith('user-1', [event], 'UTC'))
    expect(mocks.epoch).toHaveBeenCalledWith(resetAt)
    expect(mocks.epoch.mock.invocationCallOrder[0]).toBeLessThan(mocks.load.mock.invocationCallOrder[0])
    expect(JSON.parse(localStorage.getItem(plannerStorageKey('user-1'))!).resetAt).toBe(resetAt)
    cleanup()
  })

  it('backs up an untagged cache without restoring or pushing its tasks', async () => {
    const raw = JSON.stringify({ schemaVersion: 2, events: [event], modifiedAt: resetAt + 100 })
    localStorage.setItem(plannerStorageKey('user-1'), raw)
    const cleanup = await start()
    expect(mocks.sync).not.toHaveBeenCalled()
    expect(JSON.parse(localStorage.getItem(plannerStorageKey('user-1'))!).events).toEqual([])
    expect(localStorage.getItem(`${plannerStorageKey('user-1')}:reset-backup:${resetAt + 100}`)).toBe(raw)
    cleanup()
  })

  it('clears the request epoch when the user signs out', async () => {
    const cleanup = await start()
    mocks.authCallback!('SIGNED_OUT', null)
    await vi.waitFor(() => expect(mocks.epoch).toHaveBeenLastCalledWith(0))
    cleanup()
  })

  it('does not push or relabel the cache when the profile read fails', async () => {
    const raw = serializeLocalPlannerEnvelope([event], resetAt + 100, resetAt)
    localStorage.setItem(plannerStorageKey('user-1'), raw)
    mocks.profile.mockRejectedValue(new Error('Network unavailable'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    usePlanner()
    const cleanup = mocks.effects[0]() as () => void
    await vi.waitFor(() => expect(error).toHaveBeenCalled())
    expect(mocks.sync).not.toHaveBeenCalled()
    expect(mocks.epoch).not.toHaveBeenCalled()
    expect(localStorage.getItem(plannerStorageKey('user-1'))).toBe(raw)
    cleanup()
    error.mockRestore()
  })
})
