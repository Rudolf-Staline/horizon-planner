import type { PlannerEvent } from './types'
import {
  conflictsFor,
  findNextAvailableSlot,
} from './scheduling'

export type ReplanProposal = {
  eventId: string
  eventTitle: string
  date?: string
  day: number
  startMin: number
  fromDate?: string
  fromDay: number
  fromStartMin: number
  reason:
    | 'move-current-flexible'
    | 'move-conflicting-flexible'
}

function isMovableFlexible(
  event: PlannerEvent,
) {
  return (
    event.kind === 'flexible' &&
    !event.locked &&
    !event.virtual &&
    event.entityType !== 'routine'
  )
}

function toProposal(
  event: PlannerEvent,
  events: PlannerEvent[],
  reason: ReplanProposal['reason'],
): ReplanProposal | null {
  const slot =
    findNextAvailableSlot(
      event,
      events,
    )

  if (!slot) return null

  return {
    eventId: event.id,
    eventTitle: event.title,
    date: slot.date,
    day: slot.day,
    startMin: slot.startMin,
    fromDate: event.date,
    fromDay: event.day,
    fromStartMin:
      event.startMin,
    reason,
  }
}

export function proposeConflictReplan(
  event: PlannerEvent,
  events: PlannerEvent[],
): ReplanProposal | null {
  const conflicts =
    conflictsFor(
      event,
      events,
    )

  if (conflicts.length === 0) {
    return null
  }

  if (
    isMovableFlexible(event)
  ) {
    return toProposal(
      event,
      events,
      'move-current-flexible',
    )
  }

  // Conservative first step: when the current
  // item is fixed, only propose moving the other
  // side if exactly one movable flexible item is
  // involved. We deliberately avoid silently
  // choosing among several flexible conflicts.
  if (
    conflicts.length !== 1 ||
    !isMovableFlexible(
      conflicts[0],
    )
  ) {
    return null
  }

  return toProposal(
    conflicts[0],
    events,
    'move-conflicting-flexible',
  )
}
