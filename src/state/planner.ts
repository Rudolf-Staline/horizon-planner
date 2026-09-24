import { useEffect, useMemo, useRef, useState } from 'react'
import type { PlannerEvent } from '../domain/types'
import { seedEvents } from '../domain/seed'
import { conflictsFor, findNextAvailableSlot } from '../domain/scheduling'
import {
  currentCloudUser,
  loadCloudSnapshot,
  saveCloudSnapshot,
  syncProfileTimezone,
} from '../data/cloudSnapshot'
import { supabase } from '../lib/supabase'

const STORAGE_KEY = 'horizon-planner-v1'

type Snapshot = PlannerEvent[]

type LocalEnvelope = {
  schemaVersion: 1
  events: PlannerEvent[]
  modifiedAt: number
}

export type CloudStatus = 'local' | 'syncing' | 'synced' | 'error'

function loadLocalSnapshot(): LocalEnvelope {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {
        schemaVersion: 1,
        events: seedEvents,
        modifiedAt: 0,
      }
    }

    const parsed = JSON.parse(raw)

    // Backward compatibility with the first prototype, which stored the
    // PlannerEvent[] directly.
    if (Array.isArray(parsed)) {
      return {
        schemaVersion: 1,
        events: parsed,
        modifiedAt: 0,
      }
    }

    if (
      parsed &&
      parsed.schemaVersion === 1 &&
      Array.isArray(parsed.events) &&
      typeof parsed.modifiedAt === 'number'
    ) {
      return parsed as LocalEnvelope
    }
  } catch {
    // Fall through to seed data.
  }

  return {
    schemaVersion: 1,
    events: seedEvents,
    modifiedAt: 0,
  }
}

function persistLocal(
  events: PlannerEvent[],
  modifiedAt: number,
) {
  const envelope: LocalEnvelope = {
    schemaVersion: 1,
    events,
    modifiedAt,
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope))
}

export function usePlanner() {
  const initialRef = useRef<LocalEnvelope | null>(null)
  if (!initialRef.current) {
    initialRef.current = loadLocalSnapshot()
  }

  const [events, setEvents] = useState<PlannerEvent[]>(
    initialRef.current.events,
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [lastConflictId, setLastConflictId] = useState<string | null>(null)
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>('local')
  const [cloudUserEmail, setCloudUserEmail] = useState<string | null>(null)

  const undoStack = useRef<Snapshot[]>([])
  const redoStack = useRef<Snapshot[]>([])
  const modifiedAtRef = useRef(initialRef.current.modifiedAt)
  const eventsRef = useRef(events)
  const cloudUserIdRef = useRef<string | null>(null)
  const skipNextCloudPushRef = useRef(false)

  useEffect(() => {
    eventsRef.current = events
    persistLocal(events, modifiedAtRef.current)
  }, [events])

  useEffect(() => {
    if (!supabase) {
      setCloudStatus('local')
      return
    }

    let cancelled = false

    const reconcile = async (
      user: Awaited<ReturnType<typeof currentCloudUser>>,
    ) => {
      if (cancelled) return

      if (!user) {
        cloudUserIdRef.current = null
        setCloudUserEmail(null)
        setCloudStatus('local')
        return
      }

      cloudUserIdRef.current = user.id
      setCloudUserEmail(user.email ?? null)
      setCloudStatus('syncing')

      try {
        const browserTimezone =
          Intl.DateTimeFormat().resolvedOptions().timeZone

        if (browserTimezone) {
          try {
            await syncProfileTimezone(user.id, browserTimezone)
          } catch {
            // Timezone sync is helpful metadata, not a blocker for planning sync.
          }
        }

        const remote = await loadCloudSnapshot(user.id)
        if (cancelled) return

        if (
          remote &&
          remote.modifiedAt > modifiedAtRef.current
        ) {
          modifiedAtRef.current = remote.modifiedAt
          eventsRef.current = remote.events
          skipNextCloudPushRef.current = true
          setEvents(remote.events)
        } else {
          if (modifiedAtRef.current <= 0) {
            modifiedAtRef.current = Date.now()
            persistLocal(
              eventsRef.current,
              modifiedAtRef.current,
            )
          }

          await saveCloudSnapshot(
            user.id,
            eventsRef.current,
            modifiedAtRef.current,
          )
        }

        if (!cancelled) setCloudStatus('synced')
      } catch {
        if (!cancelled) setCloudStatus('error')
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
    if (!userId) return

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
  }, [events])

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
    modifiedAtRef.current = Date.now()
    eventsRef.current = next
    setEvents(next)
  }

  const commit = (next: PlannerEvent[]) => {
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
  }
}
