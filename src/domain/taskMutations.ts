import type { PlannerEvent } from './types'
import {
  isTaskEntity,
  logicalTaskId,
} from './taskIdentity'

function sameTask(
  event: PlannerEvent,
  taskId: string,
) {
  return (
    isTaskEntity(event) &&
    logicalTaskId(event) === taskId
  )
}

export function toggleEventCompleted(
  events: PlannerEvent[],
  id: string,
) {
  if (
    !events.some(
      (event) => event.id === id,
    )
  ) {
    return events
  }

  return events.map((event) =>
    event.id === id
      ? {
          ...event,
          completed:
            !event.completed,
        }
      : event,
  )
}

export function toggleLogicalTaskCompleted(
  events: PlannerEvent[],
  id: string,
) {
  const target = events.find(
    (event) => event.id === id,
  )

  if (!target) return events

  if (!isTaskEntity(target)) {
    return toggleEventCompleted(
      events,
      id,
    )
  }

  const taskId =
    logicalTaskId(target)
  const siblings = events.filter(
    (event) =>
      sameTask(event, taskId),
  )
  const nextCompleted =
    !siblings.every(
      (event) =>
        Boolean(event.completed),
    )

  return events.map((event) =>
    sameTask(event, taskId)
      ? {
          ...event,
          completed: nextCompleted,
        }
      : event,
  )
}

function chronologicalSegments(
  events: PlannerEvent[],
  taskId: string,
) {
  return events
    .filter(
      (event) =>
        sameTask(event, taskId),
    )
    .sort(
      (a, b) =>
        (a.date ?? '').localeCompare(
          b.date ?? '',
        ) ||
        a.startMin - b.startMin ||
        a.id.localeCompare(b.id),
    )
}

export function deletePlannerEvent(
  events: PlannerEvent[],
  id: string,
) {
  const target = events.find(
    (event) => event.id === id,
  )

  if (!target) return events

  let next = events.filter(
    (event) => event.id !== id,
  )

  if (!isTaskEntity(target)) {
    return next
  }

  const taskId =
    logicalTaskId(target)
  const remaining =
    chronologicalSegments(
      next,
      taskId,
    )
  const indexById = new Map(
    remaining.map(
      (event, index) => [
        event.id,
        index,
      ],
    ),
  )

  next = next.map((event) => {
    const index =
      indexById.get(event.id)

    if (index === undefined) {
      return event
    }

    return {
      ...event,
      segmentIndex: index,
      segmentCount:
        remaining.length,
    }
  })

  return next
}

export function deleteLogicalTask(
  events: PlannerEvent[],
  id: string,
) {
  const target = events.find(
    (event) => event.id === id,
  )

  if (!target) {
    return {
      events,
      removedIds:
        new Set<string>(),
    }
  }

  if (!isTaskEntity(target)) {
    return {
      events:
        deletePlannerEvent(
          events,
          id,
        ),
      removedIds:
        new Set([id]),
    }
  }

  const taskId =
    logicalTaskId(target)
  const removedIds = new Set(
    events
      .filter(
        (event) =>
          sameTask(
            event,
            taskId,
          ),
      )
      .map(
        (event) => event.id,
      ),
  )

  return {
    events: events.filter(
      (event) =>
        !removedIds.has(
          event.id,
        ),
    ),
    removedIds,
  }
}
