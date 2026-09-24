import { useEffect, useMemo, useRef, useState } from 'react'
import type { PlannerEvent } from '../domain/types'
import { conflictsFor, findNextAvailableSlot } from '../domain/scheduling'
import {
  currentCloudUser,
  loadCloudSnapshot,
  saveCloudSnapshot,
  syncProfileTimezone,
} from '../data/cloudSnapshot'
import { supabase } from '../lib/supabase'

const LEGACY_STORAGE_KEY = 'horizon-planner-v1'
const STORAGE_PREFIX = 'horizon-planner-v2'

type Snapshot = PlannerEvent[]

type LocalEnvelope = {
  schemaVersion: 2
  events: PlannerEvent[]
  modifiedAt: number
}

export type CloudStatus = 'local' | 'syncing' | 'synced' | 'error'
export type AuthStatus = 'loading' | 'anonymous' | 'authenticated'

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`
}

function loadLocalSnapshot(userId: string): LocalEnvelope | null {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return null

    const parsed = JSON.parse(raw)

    if (
      parsed &&
      parsed.schemaVersion === 2 &&
      Array.isArray(parsed.events) &&
      typeof parsed.modifiedAt === 'number'
    ) {
      return parsed as LocalEnvelope
    }
  } catch {
    return null
  }

  return null
}

function persistLocal(
  userId: string,
  events: PlannerEvent[],
  modifiedAt: number,
) {
  const envelope: LocalEnvelope = {
    schemaVersion: 2,
    events,
    modifiedAt,
  }

  localStorage.setItem(
    storageKey(userId),
    JSON.stringify(envelope),
  )
}

function clearLocalCache(userId: string | null) {
  if (userId) {
    localStorage.removeItem(storageKey(userId))
  }

  // Never expose the old account-agnostic cache again.
  localStorage.removeItem(LEGACY_STORAGE_KEY)
}

export function usePlanner() {
  const [events, setEvents] = useState<PlannerEvent[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [lastConflictId, setLastConflictId] = useState<string | null>(null)
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>('syncing')
  const [cloudUserEmail, setCloudUserEmail] = useState<string | null>(null)
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading')

  const undoStack = useRef<Snapshot[]>([])
  const redoStack = useRef<Snapshot[]>([])
  const modifiedAtRef = useRef(0)
  const eventsRef = useRef<PlannerEvent[]>([])
  const cloudUserIdRef = useRef<string | null>(null)
  const skipNextCloudPushRef = useRef(false)

  const resetPrivateState = (clearCache: boolean) => {
    const previousUserId = cloudUserIdRef.current

    if (clearCache) {
      clearLocalCache(previousUserId)
    } else {
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    }

    cloudUserIdRef.current = null
    modifiedAtRef.current = 0
    eventsRef.current = []
    undoStack.current = []
    redoStack.current = []
    skipNextCloudPushRef.current = false

    setEvents([])
    setSelectedId(null)
    setLastConflictId(null)
    setCloudUserEmail(null)
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

      setAuthStatus('loading')
      localStorage.removeItem(LEGACY_STORAGE_KEY)

      cloudUserIdRef.current = user.id
      setCloudUserEmail(user.email ?? null)
      setCloudStatus('syncing')

      try {
        const browserTimezone =
          Intl.DateTimeFormat().resolvedOptions().timeZone

        const [remote] = await Promise.all([
          loadCloudSnapshot(user.id),
          browserTimezone
            ? syncProfileTimezone(user.id, browserTimezone)
                .catch(() => undefined)
            : Promise.resolve(),
        ])

        if (cancelled) return

        const local = loadLocalSnapshot(user.id)

        let nextEvents: PlannerEvent[] = []
        let nextModifiedAt = 0
        let shouldPush = false

        if (remote && local) {
          if (remote.modifiedAt >= local.modifiedAt) {
            nextEvents = remote.events
            nextModifiedAt = remote.modifiedAt
          } else {
            nextEvents = local.events
            nextModifiedAt = local.modifiedAt
            shouldPush = true
          }
        } else if (remote) {
          nextEvents = remote.events
          nextModifiedAt = remote.modifiedAt
        } else if (local) {
          nextEvents = local.events
          nextModifiedAt = local.modifiedAt
          shouldPush = true
        } else {
          nextEvents = []
          nextModifiedAt = Date.now()
          shouldPush = true
        }

        modifiedAtRef.current = nextModifiedAt
        eventsRef.current = nextEvents
        persistLocal(user.id, nextEvents, nextModifiedAt)

        if (shouldPush) {
          await saveCloudSnapshot(
            user.id,
            nextEvents,
            nextModifiedAt,
          )
        }

        if (cancelled) return

        skipNextCloudPushRef.current = true
        setEvents(nextEvents)
        setCloudStatus('synced')
        setAuthStatus('authenticated')
      } catch {
        if (cancelled) return

        // Do not reveal stale local planning data if cloud identity
        // reconciliation failed.
        resetPrivateState(false)
        setCloudStatus('error')
        setAuthStatus('anonymous')
      }
    }

    currentCloudUser().then(reconcile)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => {
        reconcile(session?.user ?? null)
      })
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
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
        await saveCloudSnapshot(
          userId,
          events,
          modifiedAtRef.current,
        )
        setCloudStatus('synced')
      } catch {
        setCloudStatus('error')
      }
    }, 650)

    return () => window.clearTimeout(timer)
  }, [events, authStatus])

  const selected = useMemo(
    () => events.find((e) => e.id === selectedId) ?? null,
    [events, selectedId],
  )

  const conflictEvent = useMemo(
    () => events.find((e) => e.id === lastConflictId) ?? null,
    [events, lastConflictId],
  )

  const conflicts = useMemo(
    () => conflictEvent ? conflictsFor(conflictEvent, events) : [],
    [conflictEvent, events],
  )

  const suggestion = useMemo(
    () => conflictEvent
      ? findNextAvailableSlot(conflictEvent, events)
      : null,
    [conflictEvent, events],
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

  const createEvents = (created: PlannerEvent[]) => {
    if (created.length === 0) return

    const next = [...events, ...created]
    commit(next)

    const conflicted = created.find(
      (event) => conflictsFor(event, next).length > 0,
    )

    setLastConflictId(conflicted?.id ?? null)
  }

  const createEvent = (event: PlannerEvent) => {
    createEvents([event])
  }

  const toggleCompleted = (id: string) => {
    const next = events.map((event) =>
      event.id === id
        ? { ...event, completed: !event.completed }
        : event
    )

    commit(next)
  }

  const deleteEvent = (id: string) => {
    const target = events.find((event) => event.id === id)
    if (target?.locked) return

    commit(events.filter((event) => event.id !== id))
    setSelectedId((current) => (
      current === id ? null : current
    ))
    setLastConflictId((current) => (
      current === id ? null : current
    ))
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
      !suggestion ||
      conflictEvent.locked
    ) {
      return
    }

    updateEvent(conflictEvent.id, suggestion)
    setLastConflictId(null)
  }

  return {
    events,
    selectedId,
    selected,
    setSelectedId,
    updateEvent,
    createEvent,
    createEvents,
    toggleCompleted,
    deleteEvent,
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
    cloudUserEmail,
    authStatus,
  }
}
