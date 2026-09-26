import { END_MIN, SNAP_MINUTES, START_MIN } from './constants'
import { dateForWeekday } from '../utils/date'
import type { EnergyLevel, Placement, PlannerEvent, Priority } from './types'

export function overlaps(
  a: Pick<PlannerEvent, 'date' | 'day' | 'startMin' | 'durationMin'>,
  b: Pick<PlannerEvent, 'date' | 'day' | 'startMin' | 'durationMin'>,
) {
  if (a.date && b.date) {
    if (a.date !== b.date) return false
  } else if (a.day !== b.day) {
    return false
  }

  const aEnd = a.startMin + a.durationMin
  const bEnd = b.startMin + b.durationMin
  return a.startMin < bEnd && b.startMin < aEnd
}

export function conflictsFor(event: PlannerEvent, events: PlannerEvent[]) {
  return events.filter(
    (other) => other.id !== event.id && overlaps(event, other),
  )
}

function energyPenalty(
  energy: EnergyLevel | undefined,
  startMin: number,
) {
  if (!energy) return 0
  const hour = startMin / 60

  const preferred =
    energy === 'high' ? [8, 12.5] :
    energy === 'medium' ? [10, 18.5] :
    [16, 21.5]

  if (hour >= preferred[0] && hour <= preferred[1]) return 0

  const distanceHours =
    hour < preferred[0]
      ? preferred[0] - hour
      : hour - preferred[1]

  return Math.round(distanceHours * 8)
}

function priorityUrgency(priority: Priority | undefined) {
  if (priority === 'high') return 3
  if (priority === 'medium') return 2
  return 1
}

export function scorePlacement(
  event: PlannerEvent,
  placement: Pick<Placement, 'day' | 'startMin'>,
) {
  const dayDistance = Math.max(0, placement.day - event.day)
  const timeDistance =
    Math.abs(placement.startMin - event.startMin) / SNAP_MINUTES
  const deadline = event.deadlineDay ?? 6
  const daysLeftAfterPlacement =
    Math.max(0, deadline - placement.day)
  const urgency = priorityUrgency(event.priority)

  return (
    dayDistance * 80 +
    timeDistance * 1.5 +
    energyPenalty(event.energy, placement.startMin) +
    daysLeftAfterPlacement * -urgency
  )
}

function validDayRange(event: PlannerEvent) {
  const first = Math.max(0, event.day)
  const last = Math.min(
    6,
    Math.max(first, event.deadlineDay ?? 6),
  )
  return { first, last }
}

function dailyBounds(event: PlannerEvent) {
  return {
    start: Math.max(
      START_MIN,
      event.windowStartMin ?? START_MIN,
    ),
    end: Math.min(
      END_MIN,
      event.windowEndMin ?? END_MIN,
    ),
  }
}

export function findCandidatePlacements(
  event: PlannerEvent,
  events: PlannerEvent[],
  durationMin = event.durationMin,
): Placement[] {
  const { first, last } = validDayRange(event)
  const { start: windowStart, end: windowEnd } =
    dailyBounds(event)
  const candidates: Placement[] = []

  for (let day = first; day <= last; day++) {
    for (
      let startMin = windowStart;
      startMin + durationMin <= windowEnd;
      startMin += SNAP_MINUTES
    ) {
      const date =
        event.date
          ? dateForWeekday(event.date, day)
          : undefined

      const candidate: PlannerEvent = {
        ...event,
        date,
        day,
        startMin,
        durationMin,
      }

      if (conflictsFor(candidate, events).length > 0) continue

      candidates.push({
        day,
        date,
        startMin,
        durationMin,
        score: scorePlacement(event, { day, startMin }),
      })
    }
  }

  return candidates.sort((a, b) =>
    a.score - b.score ||
    a.day - b.day ||
    a.startMin - b.startMin
  )
}

export function findBestPlacement(
  event: PlannerEvent,
  events: PlannerEvent[],
) {
  if (event.kind !== 'flexible') return null
  return findCandidatePlacements(event, events)[0] ?? null
}

export function findNextAvailableSlot(
  event: PlannerEvent,
  events: PlannerEvent[],
) {
  const placement = findBestPlacement(event, events)
  return placement
    ? {
        date: placement.date,
        day: placement.day,
        startMin: placement.startMin,
      }
    : null
}

export function planSplitTask(
  event: PlannerEvent,
  events: PlannerEvent[],
): Placement[] | null {
  if (!event.splittable || event.kind !== 'flexible') return null

  const minChunk = Math.max(
    SNAP_MINUTES,
    event.minChunkMin ?? 30,
  )
  let remaining = event.durationMin
  const placements: Placement[] = []
  const blocked = [...events]

  while (remaining > 0) {
    const targetChunk = Math.min(remaining, 90)
    let selected: Placement | null = null

    for (
      let chunk = targetChunk;
      chunk >= Math.min(minChunk, remaining);
      chunk -= SNAP_MINUTES
    ) {
      const candidate =
        findCandidatePlacements(event, blocked, chunk)[0]

      if (candidate) {
        selected = candidate
        break
      }
    }

    if (!selected && remaining < minChunk) {
      selected =
        findCandidatePlacements(
          event,
          blocked,
          remaining,
        )[0] ?? null
    }

    if (!selected) return null

    placements.push(selected)
    blocked.push({
      ...event,
      id: `${event.id}:segment:${placements.length}`,
      date: selected.date,
      day: selected.day,
      startMin: selected.startMin,
      durationMin: selected.durationMin,
    })
    remaining -= selected.durationMin
  }

  return placements
}

export function planFlexibleTask(
  event: PlannerEvent,
  events: PlannerEvent[],
) {
  if (event.kind !== 'flexible') return null

  const whole = findBestPlacement(event, events)
  if (whole) {
    return {
      kind: 'single' as const,
      placements: [whole],
    }
  }

  const split = planSplitTask(event, events)
  if (split) {
    return {
      kind: 'split' as const,
      placements: split,
    }
  }

  return null
}
