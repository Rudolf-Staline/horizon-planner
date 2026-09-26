import { useEffect, useMemo, useRef, useState } from 'react'
import type { PlannerEvent } from '../domain/types'
import { conflictsFor } from '../domain/scheduling'
import { proposeConflictReplan } from '../domain/replanning'
import type { SchedulingOptions } from '../domain/scheduling'
import { currentCloudUser } from '../data/auth'
import {
  loadOwnProfile,
  syncProfileTimezone,
  type UserRole,
} from '../data/profile'
import {
  DEFAULT_PLANNER_PREFERENCES,
  type PlannerPreferences,
} from '../domain/preferences'
import { supabase } from '../lib/supabase'
import {
  loadNormalizedPlanner,
  syncNormalizedPlanner,
} from '../data/normalizedPlanner'
import { choosePlannerSource } from './plannerReconcile'
import {
  LEGACY_STORAGE_KEY,
  parseLocalPlannerEnvelope,
  plannerStorageKey,
  serializeLocalPlannerEnvelope,
  type LocalPlannerEnvelope,
} from './plannerStorage'

export type CloudStatus =
  | 'local'
  | 'syncing'
  | 'synced'
  | 'error'

export type AuthStatus =
  | 'loading'
  | 'anonymous'
  | 'authenticated'
  | 'recovery'

type Snapshot = PlannerEvent[]

import { migrateLegacyEventDates } from '../utils/date'
import {
  isCalendarEntity,
  logicalTaskId,
} from '../domain/taskIdentity'
import {
  deleteLogicalTask,
  deletePlannerEvent,
  toggleEventCompleted,
  toggleLogicalTaskCompleted,
} from '../domain/taskMutations'

function loadLocalSnapshot(
  userId: string,
): LocalPlannerEnvelope | null {
  return parseLocalPlannerEnvelope(
    localStorage.getItem(
      plannerStorageKey(userId),
    ),
  )
}

function persistLocal(
  userId: string,
  events: PlannerEvent[],
  modifiedAt: number,
) {
  localStorage.setItem(
    plannerStorageKey(userId),
    serializeLocalPlannerEnvelope(
      events,
      modifiedAt,
    ),
  )
}

function clearLocalCache(
  userId: string | null,
) {
  if (userId) {
    localStorage.removeItem(
      plannerStorageKey(userId),
    )
  }

  localStorage.removeItem(
    LEGACY_STORAGE_KEY,
  )
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function migrateLegacyEventIds(
  events: PlannerEvent[],
) {
  let changed = false

  const migrated = events.map(
    (event) => {
      if (
        UUID_PATTERN.test(event.id)
      ) {
        return event
      }

      changed = true
      return {
        ...event,
        id: crypto.randomUUID(),
      }
    },
  )

  return {
    events: migrated,
    changed,
  }
}


function migrateLegacyFlexibleCategory(
  events: PlannerEvent[],
) {
  let changed = false

  const migrated = events.map((event) => {
    if (
      (event as { category?: string }).category !==
      'flexible'
    ) {
      return event
    }

    changed = true
    return {
      ...event,
      category: 'neutral' as const,
    }
  })

  return {
    events: migrated,
    changed,
  }
}

function migratePlannerIdentity(
  events: PlannerEvent[],
) {
  let changed = false

  const migrated = events.map((event) => {
    if (event.virtual) {
      if (event.entityType === 'routine') return event

      changed = true
      return {
        ...event,
        entityType: 'routine' as const,
      }
    }

    if (event.entityType === 'calendar') {
      return event
    }

    if (
      event.entityType === 'task' &&
      event.taskId
    ) {
      return event
    }

    if (isCalendarEntity(event)) {
      changed = true
      return {
        ...event,
        entityType: 'calendar' as const,
      }
    }

    changed = true
    return {
      ...event,
      entityType: 'task' as const,
      taskId: event.taskId ?? event.id,
      segmentIndex:
        event.segmentIndex ?? 0,
      segmentCount:
        event.segmentCount ?? 1,
    }
  })

  return { events: migrated, changed }
}

const TASK_METADATA_KEYS = [
  'title',
  'notes',
  'category',
  'projectId',
  'priority',
  'kind',
  'locked',
  'deadlineDay',
  'deadlineDate',
  'windowStartMin',
  'windowEndMin',
  'energy',
  'splittable',
  'minChunkMin',
] as const

function taskMetadataPatch(
  patch: Partial<PlannerEvent>,
) {
  const metadata: Partial<PlannerEvent> = {}

  for (const key of TASK_METADATA_KEYS) {
    if (key in patch) {
      ;(metadata as Record<string, unknown>)[key] =
        patch[key]
    }
  }

  return metadata
}

function isRecoveryUrl() {
  return (
    window.location.hash.includes('type=recovery') ||
    new URLSearchParams(window.location.search).get('type') ===
      'recovery'
  )
}

export function usePlanner() {
  const [events, setEvents] = useState<PlannerEvent[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [lastConflictId, setLastConflictId] = useState<string | null>(null)
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>('syncing')
  const [cloudUserId, setCloudUserId] = useState<string | null>(null)
  const [cloudUserEmail, setCloudUserEmail] = useState<string | null>(null)
  const [cloudDisplayName, setCloudDisplayName] = useState<string | null>(null)
  const [cloudUserRole, setCloudUserRole] = useState<UserRole>('user')
  const [cloudPreferences, setCloudPreferences] = useState<PlannerPreferences>(DEFAULT_PLANNER_PREFERENCES)
  const [authStatus, setAuthStatus] = useState<AuthStatus>(
    () => isRecoveryUrl() ? 'recovery' : 'loading',
  )

  const undoStack = useRef<Snapshot[]>([])
  const redoStack = useRef<Snapshot[]>([])
  const modifiedAtRef = useRef(0)
  const eventsRef = useRef<PlannerEvent[]>([])
  const cloudUserIdRef = useRef<string | null>(null)
  const realtimeChannelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null)
  const skipNextCloudPushRef = useRef(false)
  const recoveryRef = useRef(isRecoveryUrl())

  const resetPrivateState = (clearCache: boolean) => {
    const previousUserId = cloudUserIdRef.current

    if (clearCache) {
      clearLocalCache(previousUserId)
    } else {
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    }

    cloudUserIdRef.current = null
    if (realtimeChannelRef.current && supabase) {
      void supabase.removeChannel(realtimeChannelRef.current)
      realtimeChannelRef.current = null
    }
    modifiedAtRef.current = 0
    eventsRef.current = []
    undoStack.current = []
    redoStack.current = []
    skipNextCloudPushRef.current = false

    setCloudUserId(null)
    setEvents([])
    setSelectedId(null)
    setLastConflictId(null)
    setCloudUserEmail(null)
    setCloudDisplayName(null)
    setCloudUserRole('user')
    setCloudPreferences(DEFAULT_PLANNER_PREFERENCES)
  }

  useEffect(() => {
    if (!supabase) {
      resetPrivateState(false)
      setCloudStatus('error')
      setAuthStatus('anonymous')
      return
    }

    let cancelled = false

    const reconcile = async (
      user: Awaited<ReturnType<typeof currentCloudUser>>,
    ) => {
      if (cancelled) return

      if (!user) {
        resetPrivateState(true)
        setCloudStatus('local')
        setAuthStatus('anonymous')
        return
      }

      cloudUserIdRef.current = user.id
      setCloudUserId(user.id)
      setCloudUserEmail(user.email ?? null)

      if (recoveryRef.current) {
        setAuthStatus('recovery')
        return
      }

      setAuthStatus('loading')
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      setCloudStatus('syncing')

      try {
        const browserTimezone =
          Intl.DateTimeFormat().resolvedOptions().timeZone

        let normalizedReadFailed = false

        const profile = await loadOwnProfile(user.id).catch(() => null)
        const timeZone = profile?.preferences.timezone || browserTimezone || 'UTC'
        const normalized = await loadNormalizedPlanner(user.id, timeZone).catch(() => {
          normalizedReadFailed = true
          return null
        })
        if (browserTimezone && !profile?.preferences.timezone) {
          await syncProfileTimezone(user.id, browserTimezone).catch(() => undefined)
        }

        if (cancelled) return

        setCloudDisplayName(
          profile?.displayName ??
            user.user_metadata?.display_name ??
            user.email?.split('@')[0] ??
            null,
        )
        setCloudUserRole(profile?.role ?? 'user')
        setCloudPreferences(profile?.preferences ?? {
          ...DEFAULT_PLANNER_PREFERENCES,
          timezone: browserTimezone || DEFAULT_PLANNER_PREFERENCES.timezone,
        })

        const local = loadLocalSnapshot(user.id)

        const choice = choosePlannerSource({
          normalized,
          local,
          normalizedReadFailed,
          now: Date.now(),
        })

        let nextEvents = choice.events
        let nextModifiedAt = choice.modifiedAt
        let shouldPush = choice.shouldPush

        const dateMigration =
          migrateLegacyEventDates(nextEvents)
        if (dateMigration.changed) {
          nextEvents =
            dateMigration.events
          nextModifiedAt = Date.now()
          shouldPush = true
        }

        const idMigration =
          migrateLegacyEventIds(nextEvents)
        if (idMigration.changed) {
          nextEvents =
            idMigration.events
          nextModifiedAt = Date.now()
          shouldPush = true
        }

        const categoryMigration =
          migrateLegacyFlexibleCategory(
            nextEvents,
          )
        if (categoryMigration.changed) {
          nextEvents =
            categoryMigration.events
          nextModifiedAt = Date.now()
          shouldPush = true
        }

        const identityMigration =
          migratePlannerIdentity(nextEvents)
        if (identityMigration.changed) {
          nextEvents =
            identityMigration.events
          nextModifiedAt = Date.now()
          shouldPush = true
        }

        modifiedAtRef.current = nextModifiedAt
        eventsRef.current = nextEvents
        persistLocal(user.id, nextEvents, nextModifiedAt)

        if (
          shouldPush &&
          !normalizedReadFailed
        ) {
          await syncNormalizedPlanner(user.id, nextEvents, timeZone)
        }

        if (cancelled) return

        skipNextCloudPushRef.current = true
        setEvents(nextEvents)
        setCloudStatus(
          normalizedReadFailed
            ? 'error'
            : 'synced',
        )
        setAuthStatus('authenticated')

        if (
          supabase &&
          realtimeChannelRef.current === null
        ) {
          const channel = supabase
            .channel(`planner-${user.id}`)
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'tasks',
                filter: `user_id=eq.${user.id}`,
              },
              () => {
                if (!cancelled) void reconcile(user)
              },
            )
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'planned_segments',
                filter: `user_id=eq.${user.id}`,
              },
              () => {
                if (!cancelled) void reconcile(user)
              },
            )
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'calendar_events',
                filter: `user_id=eq.${user.id}`,
              },
              () => {
                if (!cancelled) void reconcile(user)
              },
            )
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'profiles',
                filter: `id=eq.${user.id}`,
              },
              () => {
                if (!cancelled) void reconcile(user)
              },
            )
            .subscribe()
          realtimeChannelRef.current = channel
        }
      } catch {
        if (cancelled) return

        resetPrivateState(false)
        setCloudStatus('error')
        setAuthStatus('anonymous')
      }
    }

    currentCloudUser().then(reconcile)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        recoveryRef.current = true
        setAuthStatus('recovery')
        return
      }

      queueMicrotask(() => {
        reconcile(session?.user ?? null)
      })
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
      if (realtimeChannelRef.current && supabase) {
        void supabase.removeChannel(realtimeChannelRef.current)
        realtimeChannelRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const userId = cloudUserIdRef.current

    if (authStatus !== 'authenticated' || !userId) {
      return
    }

    eventsRef.current = events
    persistLocal(userId, events, modifiedAtRef.current)

    if (skipNextCloudPushRef.current) {
      skipNextCloudPushRef.current = false
      return
    }

    const timer = window.setTimeout(async () => {
      setCloudStatus('syncing')

      try {
        await syncNormalizedPlanner(
          userId,
          events,
          cloudPreferences.timezone,
        )
        setCloudStatus('synced')
      } catch {
        setCloudStatus('error')
      }
    }, 650)

    return () => window.clearTimeout(timer)
  }, [events, authStatus, cloudPreferences.timezone])

  const selected = useMemo(
    () => events.find((event) => event.id === selectedId) ?? null,
    [events, selectedId],
  )

  const selectedTaskSegments = useMemo(() => {
    if (!selected || selected.entityType !== 'task') {
      return []
    }

    const taskId = logicalTaskId(selected)
    return events
      .filter(
        (event) =>
          event.entityType === 'task' &&
          logicalTaskId(event) === taskId,
      )
      .sort(
        (a, b) =>
          (a.segmentIndex ?? 0) - (b.segmentIndex ?? 0) ||
          (a.date ?? '').localeCompare(b.date ?? '') ||
          a.startMin - b.startMin,
      )
  }, [events, selected])

  const conflictEvent = useMemo(
    () => events.find((event) => event.id === lastConflictId) ?? null,
    [events, lastConflictId],
  )

  const conflicts = useMemo(
    () => conflictEvent ? conflictsFor(conflictEvent, events) : [],
    [conflictEvent, events],
  )

  const suggestion = useMemo(
    () =>
      conflictEvent
        ? proposeConflictReplan(
            conflictEvent,
            events,
            {
              startMin: cloudPreferences.workdayStartMin,
              endMin: cloudPreferences.workdayEndMin,
              activeDays: cloudPreferences.activeDays,
              bufferMin: cloudPreferences.bufferMin,
              planningStepMin: cloudPreferences.planningStepMin,
            } satisfies SchedulingOptions,
          )
        : null,
    [
      conflictEvent,
      events,
      cloudPreferences.workdayStartMin,
      cloudPreferences.workdayEndMin,
      cloudPreferences.activeDays,
      cloudPreferences.bufferMin,
      cloudPreferences.planningStepMin,
    ],
  )

  const replaceEvents = (next: PlannerEvent[]) => {
    if (authStatus !== 'authenticated') return

    modifiedAtRef.current = Date.now()
    eventsRef.current = next
    setEvents(next)
  }

  const commit = (next: PlannerEvent[]) => {
    if (authStatus !== 'authenticated') return

    undoStack.current.push(events)
    redoStack.current = []
    replaceEvents(next)
  }

  const updateEvent = (
    id: string,
    patch: Partial<PlannerEvent>,
  ) => {
    const current = events.find((event) => event.id === id)
    if (!current || current.locked) return

    const next = events.map((event) =>
      event.id === id ? { ...event, ...patch } : event
    )

    commit(next)

    const changed = next.find((event) => event.id === id)
    setLastConflictId(
      changed && conflictsFor(changed, next).length
        ? id
        : null,
    )
  }

  const editEvent = (
    id: string,
    patch: Partial<PlannerEvent>,
  ) => {
    const current = events.find((event) => event.id === id)
    if (!current) return

    const metadata = taskMetadataPatch(patch)
    const currentTaskId =
      current.entityType === 'task'
        ? logicalTaskId(current)
        : null

    const next = events.map((event) => {
      if (event.id === id) {
        return { ...event, ...patch }
      }

      if (
        currentTaskId &&
        event.entityType === 'task' &&
        logicalTaskId(event) === currentTaskId
      ) {
        return { ...event, ...metadata }
      }

      return event
    })

    commit(next)
    setLastConflictId(null)
  }

  const createEvents = (created: PlannerEvent[]) => {
    if (created.length === 0) return

    const taskId =
      created.length > 1
        ? (
            created[0].taskId ??
            crypto.randomUUID()
          )
        : (
            created[0].taskId ??
            created[0].id
          )

    const normalizedCreated =
      created.map((event, index) => {
        if (event.virtual) return event

        if (
          event.entityType === 'calendar' ||
          isCalendarEntity(event)
        ) {
          return {
            ...event,
            entityType: 'calendar' as const,
          }
        }

        return {
          ...event,
          entityType: 'task' as const,
          taskId:
            event.taskId ?? taskId,
          segmentIndex:
            event.segmentIndex ?? index,
          segmentCount:
            event.segmentCount ??
            created.length,
        }
      })

    const next = [...events, ...normalizedCreated]
    commit(next)

    const conflicted = normalizedCreated.find(
      (event) => conflictsFor(event, next).length > 0,
    )

    setLastConflictId(conflicted?.id ?? null)
  }

  const createEvent = (event: PlannerEvent) => {
    createEvents([event])
  }

  const toggleCompleted = (id: string) => {
    const next =
      toggleEventCompleted(
        events,
        id,
      )

    if (next !== events) {
      commit(next)
    }
  }

  const toggleTaskCompleted = (id: string) => {
    const next =
      toggleLogicalTaskCompleted(
        events,
        id,
      )

    if (next !== events) {
      commit(next)
    }
  }

  const deleteEvent = (id: string) => {
    const next =
      deletePlannerEvent(
        events,
        id,
      )

    if (next === events) return

    commit(next)
    setSelectedId((current) =>
      current === id
        ? null
        : current,
    )
    setLastConflictId((current) =>
      current === id
        ? null
        : current,
    )
  }

  const deleteTask = (id: string) => {
    const result =
      deleteLogicalTask(
        events,
        id,
      )

    if (
      result.events === events
    ) {
      return
    }

    commit(result.events)

    setSelectedId((current) =>
      current &&
      result.removedIds.has(
        current,
      )
        ? null
        : current,
    )
    setLastConflictId((current) =>
      current &&
      result.removedIds.has(
        current,
      )
        ? null
        : current,
    )
  }

  const undo = () => {
    const previous = undoStack.current.pop()
    if (!previous) return

    redoStack.current.push(events)
    replaceEvents(previous)
    setLastConflictId(null)
  }

  const redo = () => {
    const next = redoStack.current.pop()
    if (!next) return

    undoStack.current.push(events)
    replaceEvents(next)
    setLastConflictId(null)
  }

  const acceptSuggestion = () => {
    if (
      !conflictEvent ||
      !suggestion
    ) {
      return
    }

    const target = events.find(
      (event) =>
        event.id ===
        suggestion.eventId,
    )

    if (
      !target ||
      target.locked ||
      target.kind !== 'flexible'
    ) {
      return
    }

    updateEvent(
      target.id,
      {
        date: suggestion.date,
        day: suggestion.day,
        startMin:
          suggestion.startMin,
      },
    )
    setLastConflictId(null)
  }

  return {
    events,
    selectedId,
    selected,
    selectedTaskSegments,
    setSelectedId,
    updateEvent,
    editEvent,
    createEvent,
    createEvents,
    toggleCompleted,
    toggleTaskCompleted,
    deleteEvent,
    deleteTask,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
    conflictEvent,
    conflicts,
    suggestion,
    dismissConflict: () => setLastConflictId(null),
    acceptSuggestion,
    cloudStatus,
    cloudUserId,
    cloudUserEmail,
    cloudDisplayName,
    setCloudDisplayName,
    cloudUserRole,
    cloudPreferences,
    setCloudPreferences,
    authStatus,
  }
}
