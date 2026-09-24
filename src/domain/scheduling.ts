import { END_MIN, SNAP_MINUTES, START_MIN } from './constants'
import type { PlannerEvent } from './types'

export function overlaps(a: Pick<PlannerEvent, 'day' | 'startMin' | 'durationMin'>, b: Pick<PlannerEvent, 'day' | 'startMin' | 'durationMin'>) {
  if (a.day !== b.day) return false
  const aEnd = a.startMin + a.durationMin
  const bEnd = b.startMin + b.durationMin
  return a.startMin < bEnd && b.startMin < aEnd
}

export function conflictsFor(event: PlannerEvent, events: PlannerEvent[]) {
  return events.filter((other) => other.id !== event.id && overlaps(event, other))
}

export function findNextAvailableSlot(event: PlannerEvent, events: PlannerEvent[]) {
  const earliest = event.windowStartMin ?? START_MIN
  const latestEnd = event.windowEndMin ?? END_MIN

  for (let start = Math.max(event.startMin, earliest); start + event.durationMin <= latestEnd; start += SNAP_MINUTES) {
    const candidate = { ...event, startMin: start }
    if (conflictsFor(candidate, events).length === 0) return { day: event.day, startMin: start }
  }

  for (let day = event.day + 1; day <= Math.min(event.deadlineDay ?? 6, 6); day++) {
    for (let start = START_MIN; start + event.durationMin <= END_MIN; start += SNAP_MINUTES) {
      const candidate = { ...event, day, startMin: start }
      if (conflictsFor(candidate, events).length === 0) return { day, startMin: start }
    }
  }

  return null
}
