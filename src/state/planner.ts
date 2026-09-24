import { useEffect, useMemo, useRef, useState } from 'react'
import type { PlannerEvent } from '../domain/types'
import { seedEvents } from '../domain/seed'
import { conflictsFor, findNextAvailableSlot } from '../domain/scheduling'

const STORAGE_KEY = 'horizon-planner-v1'

type Snapshot = PlannerEvent[]

function loadEvents(): PlannerEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : seedEvents
  } catch {
    return seedEvents
  }
}

export function usePlanner() {
  const [events, setEvents] = useState<PlannerEvent[]>(loadEvents)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [lastConflictId, setLastConflictId] = useState<string | null>(null)
  const undoStack = useRef<Snapshot[]>([])
  const redoStack = useRef<Snapshot[]>([])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  }, [events])

  const selected = useMemo(() => events.find((e) => e.id === selectedId) ?? null, [events, selectedId])
  const conflictEvent = useMemo(() => events.find((e) => e.id === lastConflictId) ?? null, [events, lastConflictId])
  const conflicts = useMemo(() => conflictEvent ? conflictsFor(conflictEvent, events) : [], [conflictEvent, events])
  const suggestion = useMemo(() => conflictEvent ? findNextAvailableSlot(conflictEvent, events) : null, [conflictEvent, events])

  const commit = (next: PlannerEvent[]) => {
    undoStack.current.push(events)
    redoStack.current = []
    setEvents(next)
  }

  const updateEvent = (id: string, patch: Partial<PlannerEvent>) => {
    const next = events.map((event) => (event.id === id ? { ...event, ...patch } : event))
    commit(next)
    const changed = next.find((e) => e.id === id)
    setLastConflictId(changed && conflictsFor(changed, next).length ? id : null)
  }

  const createEvent = (event: PlannerEvent) => {
    commit([...events, event])
    setLastConflictId(conflictsFor(event, [...events, event]).length ? event.id : null)
  }

  const deleteEvent = (id: string) => {
    commit(events.filter((e) => e.id !== id))
    setSelectedId((current) => (current === id ? null : current))
    setLastConflictId((current) => (current === id ? null : current))
  }

  const undo = () => {
    const previous = undoStack.current.pop()
    if (!previous) return
    redoStack.current.push(events)
    setEvents(previous)
    setLastConflictId(null)
  }

  const redo = () => {
    const next = redoStack.current.pop()
    if (!next) return
    undoStack.current.push(events)
    setEvents(next)
    setLastConflictId(null)
  }

  const acceptSuggestion = () => {
    if (!conflictEvent || !suggestion) return
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
  }
}
