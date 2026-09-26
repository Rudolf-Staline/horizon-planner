import type { PlannerEvent } from '../domain/types'

export const LEGACY_STORAGE_KEY =
  'horizon-planner-v1'
export const STORAGE_PREFIX =
  'horizon-planner-v2'

export type LocalPlannerEnvelope = {
  schemaVersion: 2
  events: PlannerEvent[]
  modifiedAt: number
}

export function plannerStorageKey(
  userId: string,
) {
  return `${STORAGE_PREFIX}:${userId}`
}

export function parseLocalPlannerEnvelope(
  raw: string | null,
): LocalPlannerEnvelope | null {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)

    if (
      !parsed ||
      parsed.schemaVersion !== 2 ||
      !Array.isArray(parsed.events) ||
      typeof parsed.modifiedAt !==
        'number' ||
      !Number.isFinite(
        parsed.modifiedAt,
      )
    ) {
      return null
    }

    return parsed as LocalPlannerEnvelope
  } catch {
    return null
  }
}

export function serializeLocalPlannerEnvelope(
  events: PlannerEvent[],
  modifiedAt: number,
) {
  const envelope: LocalPlannerEnvelope = {
    schemaVersion: 2,
    events,
    modifiedAt,
  }

  return JSON.stringify(envelope)
}
