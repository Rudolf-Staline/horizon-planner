import type { PlannerEvent } from './types'

const LEGACY_SPLIT_SUFFIX = / · \d+\/\d+$/

export function baseTaskTitle(title: string) {
  return title.replace(LEGACY_SPLIT_SUFFIX, '')
}

export function isCalendarEntity(event: PlannerEvent) {
  if (event.entityType) {
    return event.entityType === 'calendar'
  }

  return event.kind === 'fixed' && Boolean(event.locked)
}

export function isTaskEntity(event: PlannerEvent) {
  if (event.virtual || event.entityType === 'routine') {
    return false
  }

  return !isCalendarEntity(event)
}

export function logicalTaskId(event: PlannerEvent) {
  return event.taskId ?? event.id
}

export function groupTaskEvents(events: PlannerEvent[]) {
  const groups = new Map<string, PlannerEvent[]>()

  for (const event of events) {
    if (!isTaskEntity(event)) continue

    const taskId = logicalTaskId(event)
    const current = groups.get(taskId) ?? []
    current.push(event)
    groups.set(taskId, current)
  }

  for (const group of groups.values()) {
    group.sort(
      (a, b) =>
        (a.segmentIndex ?? Number.MAX_SAFE_INTEGER) -
          (b.segmentIndex ?? Number.MAX_SAFE_INTEGER) ||
        (a.date ?? '').localeCompare(b.date ?? '') ||
        a.startMin - b.startMin,
    )
  }

  return groups
}


export function taskProgress(segments: PlannerEvent[]) {
  const totalSegments = segments.length
  const completedSegments = segments.filter(
    (segment) => Boolean(segment.completed),
  ).length
  const totalDuration = segments.reduce(
    (total, segment) => total + segment.durationMin,
    0,
  )
  const completedDuration = segments.reduce(
    (total, segment) =>
      total + (segment.completed ? segment.durationMin : 0),
    0,
  )

  return {
    totalSegments,
    completedSegments,
    totalDuration,
    completedDuration,
    percent:
      totalDuration > 0
        ? Math.round((completedDuration / totalDuration) * 100)
        : 0,
    completed:
      totalSegments > 0 &&
      completedSegments === totalSegments,
  }
}
