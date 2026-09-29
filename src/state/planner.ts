import { useEffect, useMemo, useRef, useState } from 'react'
import type { PlannerEvent } from '../domain/types'
import {
  conflictsFor,
  planFlexibleTask,
} from '../domain/scheduling'
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
import {
  choosePlannerSource,
  plannerReconcileMode,
  showsPlannerLoading,
  type PlannerReconcileMode,
} from './plannerReconcile'
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

import {
  fromISODate,
  migrateLegacyEventDates,
  weekdayIndex,
} from '../utils/date'
import {
  zonedDateMinutes,
  zonedDateToIso,
} from '../utils/timezone'
import {
  isCalendarEntity,
  isReadOnlyCalendarEvent,
  logicalTaskId,
} from '../domain/taskIdentity'
import {
  deleteLogicalTask,
  deletePlannerEvent,
  toggleEventCompleted,
  toggleLogicalTaskCompleted,
} from '../domain/taskMutations'
import {
  duplicateTask as buildDuplicateTask,
} from '../domain/taskDuplication'

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

async function withinTimeout<T>(
  work: Promise<T>,
  milliseconds: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Le chargement du planning a expiré.')),
          milliseconds,
        )
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
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
  const cloudSyncDepthRef = useRef(0)
  const realtimeRefreshTimerRef = useRef<number | null>(null)
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
    cloudSyncDepthRef.current = 0

    if (realtimeRefreshTimerRef.current !== null) {
      window.clearTimeout(realtimeRefreshTimerRef.current)
      realtimeRefreshTimerRef.current = null
    }

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
    let backgroundRefreshInFlight = false
    let backgroundRefreshPending = false
    let initialAuthEventSeen = false

    const reconcile = async (
      user: Awaited<ReturnType<typeof currentCloudUser>>,
      mode: PlannerReconcileMode = 'initial',
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

      if (showsPlannerLoading(mode)) {
        setAuthStatus('loading')
      }
      setCloudStatus('syncing')

      try {
        localStorage.removeItem(LEGACY_STORAGE_KEY)
        const browserTimezone =
          Intl.DateTimeFormat().resolvedOptions().timeZone

        let normalizedReadFailed = false

        const profile = await withinTimeout(
          loadOwnProfile(user.id),
          8_000,
        ).catch(() => null)
        const timeZone = profile?.preferences.timezone || browserTimezone || 'UTC'
        const normalized = await withinTimeout(
          loadNormalizedPlanner(user.id, timeZone),
          8_000,
        ).catch(() => {
          normalizedReadFailed = true
          return null
        })
        if (browserTimezone && !profile?.preferences.timezone) {
          void syncProfileTimezone(user.id, browserTimezone).catch(() => undefined)
        }

        if (
          cancelled ||
          cloudUserIdRef.current !== user.id
        ) {
          return
        }

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

        const dateMigration = migrateLegacyEventDates(
          nextEvents,
          fromISODate(
            zonedDateToIso(new Date(), timeZone),
          ),
        )
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
          cancelled ||
          cloudUserIdRef.current !== user.id
        ) {
          return
        }

        skipNextCloudPushRef.current = true
        setEvents(nextEvents)
        setCloudStatus(
          normalizedReadFailed
            ? 'error'
            : shouldPush ? 'syncing' : 'synced',
        )
        if (showsPlannerLoading(mode)) {
          setAuthStatus('authenticated')
        }

        if (shouldPush && !normalizedReadFailed) {
          cloudSyncDepthRef.current += 1
          try {
            await withinTimeout(
              syncNormalizedPlanner(user.id, nextEvents, timeZone),
              8_000,
            )
            if (!cancelled && cloudUserIdRef.current === user.id) {
              setCloudStatus('synced')
            }
          } catch (error) {
            console.error('[planner] Synchronisation initiale impossible', error)
            if (!cancelled && cloudUserIdRef.current === user.id) {
              setCloudStatus('error')
            }
          } finally {
            cloudSyncDepthRef.current = Math.max(
              0,
              cloudSyncDepthRef.current - 1,
            )
          }
        }

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
                if (!cancelled) scheduleRealtimeRefresh(user)
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
                if (!cancelled) scheduleRealtimeRefresh(user)
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
                if (!cancelled) scheduleRealtimeRefresh(user)
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
                if (!cancelled) scheduleRealtimeRefresh(user)
              },
            )
            .subscribe()
          realtimeChannelRef.current = channel
        }
      } catch (error) {
        if (cancelled || cloudUserIdRef.current !== user.id) return
        console.error('[planner] Chargement du planning impossible', error)

        if (mode !== 'background') {
          try {
            const cached = loadLocalSnapshot(user.id)
            if (cached) {
              modifiedAtRef.current = cached.modifiedAt
              eventsRef.current = cached.events
              skipNextCloudPushRef.current = true
              setEvents(cached.events)
            } else {
              skipNextCloudPushRef.current = true
            }
          } catch (cacheError) {
            console.error('[planner] Cache local indisponible', cacheError)
          }
          setAuthStatus('authenticated')
        }
        setCloudStatus('error')
      }
    }

    const refreshInBackground = async (
      user: NonNullable<Awaited<ReturnType<typeof currentCloudUser>>>,
    ) => {
      if (backgroundRefreshInFlight) {
        backgroundRefreshPending = true
        return
      }

      backgroundRefreshInFlight = true
      await reconcile(user, 'background')
      backgroundRefreshInFlight = false

      if (backgroundRefreshPending && !cancelled) {
        backgroundRefreshPending = false
        scheduleRealtimeRefresh(user)
      }
    }

    const scheduleRealtimeRefresh = (
      user: NonNullable<Awaited<ReturnType<typeof currentCloudUser>>>,
    ) => {
      if (realtimeRefreshTimerRef.current !== null) {
        window.clearTimeout(realtimeRefreshTimerRef.current)
      }

      const runWhenSettled = () => {
        if (cancelled) return

        if (cloudSyncDepthRef.current > 0) {
          realtimeRefreshTimerRef.current = window.setTimeout(
            runWhenSettled,
            200,
          )
          return
        }

        realtimeRefreshTimerRef.current = null
        void refreshInBackground(user)
      }

      realtimeRefreshTimerRef.current = window.setTimeout(
        runWhenSettled,
        350,
      )
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      initialAuthEventSeen = true

      if (event === 'PASSWORD_RECOVERY') {
        recoveryRef.current = true
        setAuthStatus('recovery')
        return
      }

      queueMicrotask(() => {
        const user = session?.user ?? null
        const mode = plannerReconcileMode(
          cloudUserIdRef.current,
          user?.id ?? null,
        )
        void reconcile(user, mode)
      })
    })

    // Register the listener before checking the current user. Otherwise, a
    // slow refresh of an old session can resolve after a fresh login and
    // overwrite the authenticated state with "anonymous".
    currentCloudUser().then((user) => {
      if (!initialAuthEventSeen) {
        void reconcile(user)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
      if (realtimeRefreshTimerRef.current !== null) {
        window.clearTimeout(realtimeRefreshTimerRef.current)
        realtimeRefreshTimerRef.current = null
      }
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
      cloudSyncDepthRef.current += 1

      try {
        await syncNormalizedPlanner(
          userId,
          events,
          cloudPreferences.timezone,
        )
        setCloudStatus('synced')
      } catch {
        setCloudStatus('error')
      } finally {
        cloudSyncDepthRef.current = Math.max(
          0,
          cloudSyncDepthRef.current - 1,
        )
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
              focusBlockMin: cloudPreferences.focusBlockMin,
              energyPreference: cloudPreferences.energyPreference,
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
      cloudPreferences.focusBlockMin,
      cloudPreferences.energyPreference,
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
    if (!current || current.locked || isReadOnlyCalendarEvent(current)) return

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
    if (!current || isReadOnlyCalendarEvent(current)) return

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

  const duplicateTask = (id: string) => {
    const target = events.find(
      (event) => event.id === id,
    )

    if (
      !target ||
      target.entityType !== 'task' ||
      isReadOnlyCalendarEvent(target)
    ) {
      return {
        ok: false as const,
        message: 'Seules les tâches modifiables peuvent être dupliquées.',
      }
    }

    const taskId = logicalTaskId(target)
    const taskSegments = events.filter(
      (event) =>
        event.entityType === 'task' &&
        logicalTaskId(event) === taskId,
    )
    const now = new Date()
    const todayDate = zonedDateToIso(
      now,
      cloudPreferences.timezone,
    )
    const result = buildDuplicateTask(
      target,
      taskSegments,
      events,
      todayDate,
      {
        startMin: cloudPreferences.workdayStartMin,
        endMin: cloudPreferences.workdayEndMin,
        activeDays: cloudPreferences.activeDays,
        bufferMin: cloudPreferences.bufferMin,
        planningStepMin: cloudPreferences.planningStepMin,
        focusBlockMin: cloudPreferences.focusBlockMin,
        energyPreference: cloudPreferences.energyPreference,
      },
      zonedDateMinutes(now, cloudPreferences.timezone),
    )

    if (!result.ok) return result

    commit(result.events)
    setSelectedId(result.selectedId)
    setLastConflictId(null)
    return result
  }

  const replanOverdueTask = (
    id: string,
    newDeadlineDate: string,
  ) => {
    const target = events.find((event) => event.id === id)

    if (
      !target ||
      target.entityType !== 'task' ||
      target.kind !== 'flexible'
    ) {
      return {
        ok: false as const,
        message: 'Seules les tâches flexibles peuvent être replanifiées automatiquement.',
      }
    }

    const taskId = logicalTaskId(target)
    const taskSegments = events.filter(
      (event) =>
        event.entityType === 'task' &&
        logicalTaskId(event) === taskId,
    )
    const pending = taskSegments.filter(
      (segment) => !segment.completed,
    )

    if (
      pending.length === 0 ||
      pending.some((segment) => segment.locked)
    ) {
      return {
        ok: false as const,
        message: 'Cette tâche est terminée ou comporte un bloc verrouillé.',
      }
    }

    const now = new Date()
    const todayDate = zonedDateToIso(
      now,
      cloudPreferences.timezone,
    )

    if (newDeadlineDate < todayDate) {
      return {
        ok: false as const,
        message: 'La nouvelle échéance ne peut pas être antérieure à aujourd’hui.',
      }
    }

    const planningStep = cloudPreferences.planningStepMin
    const currentMinutes = zonedDateMinutes(
      now,
      cloudPreferences.timezone,
    )
    const startMin = Math.max(
      cloudPreferences.workdayStartMin,
      Math.ceil(currentMinutes / planningStep) * planningStep,
    )
    const primary = pending[0]
    const draft: PlannerEvent = {
      ...primary,
      date: todayDate,
      day: weekdayIndex(fromISODate(todayDate)),
      startMin,
      durationMin: pending.reduce(
        (total, segment) => total + segment.durationMin,
        0,
      ),
      deadlineDate: newDeadlineDate,
      deadlineDay: weekdayIndex(fromISODate(newDeadlineDate)),
      splittable:
        pending.length > 1 || Boolean(primary.splittable),
      completed: false,
    }
    const pendingIds = new Set(
      pending.map((segment) => segment.id),
    )
    const blockers = events.filter(
      (event) => !pendingIds.has(event.id),
    )

    if (startMin > cloudPreferences.workdayStartMin) {
      blockers.push({
        ...draft,
        id: `past-window:${taskId}:${todayDate}`,
        entityType: 'calendar',
        taskId: undefined,
        date: todayDate,
        day: weekdayIndex(fromISODate(todayDate)),
        startMin: 0,
        durationMin: Math.min(startMin, 24 * 60),
        kind: 'fixed',
        locked: true,
        deadlineDate: undefined,
        deadlineDay: undefined,
      })
    }
    const plan = planFlexibleTask(
      draft,
      blockers,
      {
        startMin: cloudPreferences.workdayStartMin,
        endMin: cloudPreferences.workdayEndMin,
        activeDays: cloudPreferences.activeDays,
        bufferMin: cloudPreferences.bufferMin,
        planningStepMin: cloudPreferences.planningStepMin,
        focusBlockMin: cloudPreferences.focusBlockMin,
        energyPreference: cloudPreferences.energyPreference,
      },
    )

    if (!plan) {
      return {
        ok: false as const,
        message: 'Aucun créneau libre ne permet de respecter cette nouvelle échéance.',
      }
    }

    const replanned = plan.placements.map(
      (placement, index): PlannerEvent => ({
        ...draft,
        id: pending[index]?.id ?? crypto.randomUUID(),
        taskId,
        date: placement.date ?? todayDate,
        day: placement.day,
        startMin: placement.startMin,
        durationMin: placement.durationMin,
        completed: false,
      }),
    )
    const retained = taskSegments
      .filter((segment) => segment.completed)
      .map((segment) => ({
        ...segment,
        deadlineDate: newDeadlineDate,
        deadlineDay: weekdayIndex(fromISODate(newDeadlineDate)),
      }))
    const rebuilt = [...retained, ...replanned]
      .sort(
        (a, b) =>
          (a.date ?? '').localeCompare(b.date ?? '') ||
          a.startMin - b.startMin,
      )
      .map((segment, index, all) => ({
        ...segment,
        segmentIndex: index,
        segmentCount: all.length,
      }))
    const next = [
      ...events.filter(
        (event) =>
          !(
            event.entityType === 'task' &&
            logicalTaskId(event) === taskId
          ),
      ),
      ...rebuilt,
    ]

    commit(next)
    setSelectedId(replanned[0]?.id ?? null)
    setLastConflictId(null)

    return { ok: true as const }
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

  const importCalendarEvents = (
    imported: PlannerEvent[],
    weekKey: string,
  ) => {
    if (authStatus !== 'authenticated' || imported.length === 0) return

    const prefix = `edt:${weekKey}:`
    const importedIds = new Set(imported.map((event) => event.id))
    const now = new Date()
    const todayDate = zonedDateToIso(now, cloudPreferences.timezone)
    const currentMinutes = zonedDateMinutes(now, cloudPreferences.timezone)
    const next = [
      ...events.filter((event) => {
        if (
          event.source !== 'manual' ||
          !event.externalId?.startsWith(prefix)
        ) {
          return true
        }
        const alreadyStarted =
          (event.date ?? '') < todayDate ||
          (event.date === todayDate && event.startMin < currentMinutes)
        return importedIds.has(event.id) || alreadyStarted
      }),
      ...imported.filter(
        (event) => !events.some((current) => current.id === event.id),
      ),
    ]

    commit(next)
  }

  const toggleCompleted = (id: string) => {
    const target = events.find((event) => event.id === id)
    if (target && isReadOnlyCalendarEvent(target)) return

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
    const target = events.find((event) => event.id === id)
    if (target && isReadOnlyCalendarEvent(target)) return

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
    const target = events.find((event) => event.id === id)
    if (target && isReadOnlyCalendarEvent(target)) return

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
    const target = events.find((event) => event.id === id)
    if (target && isReadOnlyCalendarEvent(target)) return

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

  const removeExternalEvents = (
    sourceId: string,
    externalIds?: string[],
  ) => {
    const externalIdSet = externalIds
      ? new Set(externalIds)
      : null
    const next = events.filter((event) => {
      if (
        event.source === 'manual' ||
        !event.source ||
        !event.externalId
      ) {
        return true
      }

      if (externalIdSet) {
        return !externalIdSet.has(event.externalId)
      }

      return !event.externalId.startsWith(`${sourceId}:`)
    })

    if (next.length !== events.length) {
      commit(next)
    }
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
    duplicateTask,
    replanOverdueTask,
    createEvent,
    createEvents,
    importCalendarEvents,
    toggleCompleted,
    toggleTaskCompleted,
    deleteEvent,
    deleteTask,
    removeExternalEvents,
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
