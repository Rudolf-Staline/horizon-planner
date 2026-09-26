import type { PlannerEvent } from '../domain/types'

export type PlannerCandidate = {
  events: PlannerEvent[]
  modifiedAt: number
}

export type PlannerSource =
  | 'normalized'
  | 'local'
  | 'empty'

export type PlannerChoice = PlannerCandidate & {
  source: PlannerSource
  shouldPush: boolean
}

export function choosePlannerSource(input: {
  normalized: PlannerCandidate | null
  local: PlannerCandidate | null
  normalizedReadFailed?: boolean
  now: number
}): PlannerChoice {
  const {
    normalized,
    local,
    normalizedReadFailed = false,
    now,
  } = input

  if (normalizedReadFailed) {
    if (local) {
      return {
        ...local,
        source: 'local',
        shouldPush: false,
      }
    }

    return {
      events: [],
      modifiedAt: now,
      source: 'empty',
      shouldPush: false,
    }
  }

  if (normalized && local) {
    if (local.modifiedAt > normalized.modifiedAt) {
      return {
        ...local,
        source: 'local',
        shouldPush: true,
      }
    }

    return {
      ...normalized,
      source: 'normalized',
      shouldPush: false,
    }
  }

  if (normalized) {
    return {
      ...normalized,
      source: 'normalized',
      shouldPush: false,
    }
  }

  if (local) {
    return {
      ...local,
      source: 'local',
      shouldPush: true,
    }
  }

  return {
    events: [],
    modifiedAt: now,
    source: 'empty',
    shouldPush: false,
  }
}
