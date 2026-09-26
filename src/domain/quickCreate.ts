import type { PlannerEvent } from './types'
import {
  addDays,
  fromISODate,
  toISODate,
  weekdayIndex,
} from '../utils/date'

export type InlineTaskDraft = {
  date: string
  day: number
  startMin: number
}

export function buildInlineTask(
  draft: InlineTaskDraft,
  title: string,
  id = crypto.randomUUID(),
): PlannerEvent {
  const deadline =
    addDays(
      fromISODate(draft.date),
      2,
    )
  const cleanTitle =
    title.trim() ||
    'Nouvelle tâche'

  return {
    id,
    entityType: 'task',
    taskId: id,
    segmentIndex: 0,
    segmentCount: 1,
    title: cleanTitle,
    date: draft.date,
    day: draft.day,
    startMin: draft.startMin,
    durationMin: 60,
    category: 'neutral',
    priority: 'medium',
    kind: 'flexible',
    deadlineDate:
      toISODate(deadline),
    deadlineDay:
      weekdayIndex(deadline),
  }
}
