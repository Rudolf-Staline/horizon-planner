import type { PlannerEvent } from '../domain/types'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function toISODate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function fromISODate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

export function addMonths(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(1)
  next.setMonth(next.getMonth() + amount)
  return next
}

export function addYears(date: Date, amount: number) {
  const next = new Date(date)
  next.setFullYear(next.getFullYear() + amount)
  return next
}

export function startOfWeek(date: Date, weekStartsOn = 1) {
  const next = new Date(date)
  const jsDay = next.getDay()
  const offset = (jsDay - weekStartsOn + 7) % 7
  next.setDate(next.getDate() - offset)
  next.setHours(12, 0, 0, 0)
  return next
}

export function weekdayIndex(date: Date) {
  const jsDay = date.getDay()
  return jsDay === 0 ? 6 : jsDay - 1
}

export function weekDates(anchor: Date, weekStartsOn = 1) {
  const start = startOfWeek(anchor, weekStartsOn)
  return Array.from({ length: 7 }, (_, index) =>
    addDays(start, index)
  )
}

export function dateForWeekday(
  sourceDate: string,
  day: number,
  weekStartsOn = 1,
) {
  const start = startOfWeek(fromISODate(sourceDate), weekStartsOn)
  return toISODate(addDays(start, day))
}

export function sameDate(a: Date, b: Date) {
  return toISODate(a) === toISODate(b)
}

export function formatDayHeading(date: Date) {
  return {
    weekday: new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
    }).format(date).replace('.', ''),
    day: String(date.getDate()),
  }
}

export function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function formatWeekRange(anchor: Date, weekStartsOn = 1) {
  const dates = weekDates(anchor, weekStartsOn)
  const first = dates[0]
  const last = dates[6]

  if (
    first.getMonth() === last.getMonth() &&
    first.getFullYear() === last.getFullYear()
  ) {
    return `${first.getDate()} – ${last.getDate()} ${new Intl.DateTimeFormat('fr-FR', {
      month: 'long',
      year: 'numeric',
    }).format(last)}`
  }

  return `${new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
  }).format(first)} – ${new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(last)}`
}

export function formatMonth(date: Date) {
  const value = new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
  }).format(date)
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function formatYear(date: Date) {
  return String(date.getFullYear())
}

export function monthGridDates(anchor: Date, weekStartsOn = 1) {
  const first = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    1,
    12,
  )
  const start = startOfWeek(first, weekStartsOn)
  return Array.from({ length: 42 }, (_, index) =>
    addDays(start, index)
  )
}

export function eventDateLabel(event: PlannerEvent) {
  if (event.date && ISO_DATE.test(event.date)) {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(fromISODate(event.date))
  }

  return ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][
    event.day
  ] ?? 'Jour'
}

export function migrateLegacyEventDates(
  events: PlannerEvent[],
  reference = new Date(),
) {
  const dates = weekDates(reference)
  let changed = false

  const migrated = events.map((event) => {
    if (event.date && ISO_DATE.test(event.date)) {
      const expectedDay = weekdayIndex(fromISODate(event.date))
      if (expectedDay === event.day) return event
      changed = true
      return { ...event, day: expectedDay }
    }

    changed = true
    const date = dates[Math.min(6, Math.max(0, event.day))]
    return {
      ...event,
      date: toISODate(date),
      day: weekdayIndex(date),
    }
  })

  return { events: migrated, changed }
}
