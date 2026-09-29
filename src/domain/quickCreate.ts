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

export function repeatedDates(startDate: string, endDate: string, weekdays: number[]): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return []
  const start = fromISODate(startDate)
  const end = fromISODate(endDate)
  if (toISODate(start) !== startDate || toISODate(end) !== endDate ||
      endDate < startDate || endDate > toISODate(addDays(start, 30))) return []
  const selected = new Set(weekdays)
  const dates: string[] = []
  for (let offset = 0; offset < 31; offset += 1) {
    const day = addDays(start, offset)
    const iso = toISODate(day)
    if (iso > endDate) break
    if (selected.has(weekdayIndex(day))) dates.push(iso)
  }
  return dates
}

export function buildRepeatedTasks(
  dates: string[], title: string, startMin: number, durationMin: number,
  category: PlannerEvent['category'] = 'neutral',
  makeId: () => string = () => crypto.randomUUID(),
): PlannerEvent[] {
  const seriesId = dates.length > 1 ? crypto.randomUUID() : undefined
  return dates.map((date) => {
    const id = makeId()
    return {
      id, taskId: id, seriesId, entityType: 'task',
      segmentIndex: 0, segmentCount: 1,
      title: title.trim(), date, day: weekdayIndex(fromISODate(date)),
      startMin, durationMin, category, priority: 'medium', kind: 'fixed',
    }
  })
}

export function buildInlineTask(
  draft: InlineTaskDraft,
  title: string,
  id: string = crypto.randomUUID(),
  defaultDurationMin = 60,
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
    durationMin: defaultDurationMin,
    category: 'neutral',
    priority: 'medium',
    kind: 'flexible',
    deadlineDate:
      toISODate(deadline),
    deadlineDay:
      weekdayIndex(deadline),
  }
}
