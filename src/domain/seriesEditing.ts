import type { PlannerEvent } from './types'
import { addDays, fromISODate, toISODate, weekdayIndex } from '../utils/date'

export type SeriesEditScope = 'one' | 'following' | 'all'

function dateOffset(from: string, to: string) {
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number)
  const [toYear, toMonth, toDay] = to.split('-').map(Number)
  return Math.round(
    (Date.UTC(toYear, toMonth - 1, toDay) -
      Date.UTC(fromYear, fromMonth - 1, fromDay)) / 86_400_000,
  )
}

export function applySeriesEdit(
  events: PlannerEvent[],
  selectedId: string,
  patch: Partial<PlannerEvent>,
  scope: SeriesEditScope,
): PlannerEvent[] {
  const selected = events.find((item) => item.id === selectedId)
  if (!selected) return events
  if (!selected.seriesId || !selected.date || scope === 'one') {
    return events.map((item) =>
      item.id === selectedId ? { ...item, ...patch } : item,
    )
  }

  const shiftDays = patch.date ? dateOffset(selected.date, patch.date) : 0
  return events.map((item) => {
    if (
      item.seriesId !== selected.seriesId ||
      !item.date ||
      (scope === 'following' && item.date < selected.date!)
    ) return item

    const date = toISODate(addDays(fromISODate(item.date), shiftDays))
    return {
      ...item,
      ...patch,
      date,
      day: weekdayIndex(fromISODate(date)),
    }
  })
}
