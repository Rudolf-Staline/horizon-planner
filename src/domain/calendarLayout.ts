import type { PlannerEvent } from './types'

export type CalendarLane = {
  lane: number
  laneCount: number
}

function eventEnd(event: PlannerEvent) {
  return event.startMin + event.durationMin
}

function groupKey(event: PlannerEvent) {
  return event.date ?? `weekday:${event.day}`
}

function layoutCluster(
  cluster: PlannerEvent[],
  target: Map<string, CalendarLane>,
) {
  const laneEnds: number[] = []
  const assigned = new Map<string, number>()

  for (const event of cluster) {
    let lane = laneEnds.findIndex(
      (end) => end <= event.startMin,
    )

    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(eventEnd(event))
    } else {
      laneEnds[lane] = eventEnd(event)
    }

    assigned.set(event.id, lane)
  }

  const laneCount = Math.max(
    1,
    laneEnds.length,
  )

  for (const event of cluster) {
    target.set(event.id, {
      lane: assigned.get(event.id) ?? 0,
      laneCount,
    })
  }
}

export function layoutCalendarLanes(
  events: PlannerEvent[],
) {
  const result =
    new Map<string, CalendarLane>()
  const groups =
    new Map<string, PlannerEvent[]>()

  for (const event of events) {
    const key = groupKey(event)
    const group = groups.get(key) ?? []
    group.push(event)
    groups.set(key, group)
  }

  for (const group of groups.values()) {
    const sorted = [...group].sort(
      (a, b) =>
        a.startMin - b.startMin ||
        eventEnd(a) - eventEnd(b) ||
        a.id.localeCompare(b.id),
    )

    let cluster: PlannerEvent[] = []
    let clusterEnd = -Infinity

    const flush = () => {
      if (cluster.length === 0) return
      layoutCluster(cluster, result)
      cluster = []
      clusterEnd = -Infinity
    }

    for (const event of sorted) {
      if (
        cluster.length > 0 &&
        event.startMin >= clusterEnd
      ) {
        flush()
      }

      cluster.push(event)
      clusterEnd = Math.max(
        clusterEnd,
        eventEnd(event),
      )
    }

    flush()
  }

  return result
}
