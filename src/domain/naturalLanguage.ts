import { END_MIN, START_MIN } from './constants'
import type {
  Category,
  EnergyLevel,
  EventKind,
  Priority,
} from './types'
import {
  addDays,
  fromISODate,
  toISODate,
  weekdayIndex,
} from '../utils/date'

export interface ParsedTask {
  title: string
  date: string
  day: number
  startMin: number
  durationMin: number
  category: Category
  kind: EventKind
  locked?: boolean
  priority: Priority
  energy?: EnergyLevel
  deadlineDay?: number
  deadlineDate?: string
  windowStartMin?: number
  windowEndMin?: number
}

const WEEKDAYS: Array<[string, number]> = [
  ['lundi', 0],
  ['mardi', 1],
  ['mercredi', 2],
  ['jeudi', 3],
  ['vendredi', 4],
  ['samedi', 5],
  ['dimanche', 6],
]

function fold(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function clock(hours: string, minutes?: string) {
  return Math.min(
    END_MIN,
    Math.max(
      START_MIN,
      Number(hours) * 60 +
        Number(minutes || 0),
    ),
  )
}

function nextWeekday(
  source: Date,
  targetDay: number,
) {
  const delta =
    (
      targetDay -
      weekdayIndex(source) +
      7
    ) % 7

  return addDays(source, delta)
}

function inferCategory(text: string): Category {
  if (
    /\b(?:sport|courir|running|gym|entrainement)\b|\bmuscu\w*/.test(
      text,
    )
  ) {
    return 'routine'
  }

  if (
    /\b(?:cours?|td|tp|revision|reviser|edp|examen)\b|\bmath\w*|\bstat\w*|\bprobab\w*/.test(
      text,
    )
  ) {
    return 'course'
  }

  if (
    /\b(?:rapport|projet|code|coder|dev|application)\b|\bapp\b/.test(
      text,
    )
  ) {
    return 'project'
  }

  if (
    /\b(?:mail|email|admin|dossier|document)\b/.test(
      text,
    )
  ) {
    return 'admin'
  }

  if (
    /\b(?:lire|lecture|focus|travailler)\b/.test(
      text,
    )
  ) {
    return 'focus'
  }

  if (
    /\b(?:appeler|ami|mere|pere|famille|sortie)\b/.test(
      text,
    )
  ) {
    return 'personal'
  }

  return 'neutral'
}

function inferKind(
  text: string,
): {
  kind: EventKind
  locked?: boolean
} {
  if (
    /rendez[- ]?vous|reunion|cours|controle|examen/.test(
      text,
    )
  ) {
    return {
      kind: 'fixed',
      locked: true,
    }
  }
  return { kind: 'flexible' }
}

function cleanTitle(original: string) {
  let title = original

  const patterns = [
    /\bavant\s+(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/gi,
    /\b(?:aujourd['’]?hui|demain|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/gi,
    /\b(?:pendant|durant)\s+\d+\s*h\s*\d{0,2}\b/gi,
    /\b(?:pendant|durant)\s+\d+\s*(?:min|minutes?)\b/gi,
    /\b\d+\s*h\s*\d{0,2}\b/gi,
    /\b\d+\s*(?:min|minutes?)\b/gi,
    /\b(?:après|apres|avant|à|a)\s*\d{1,2}\s*h\s*\d{0,2}\b/gi,
    /\b(?:je dois|je veux|prévoir|prevoir|planifier)\b/gi,
  ]

  for (const pattern of patterns) {
    title = title.replace(pattern, ' ')
  }

  title = title
    .replace(/\s+/g, ' ')
    .replace(
      /^\s*(?:faire|de|du|la|le)\s+/i,
      '',
    )
    .replace(/[,.]+\s*$/g, '')
    .trim()

  if (!title) return 'Nouvelle tâche'

  return (
    title.charAt(0).toUpperCase() +
    title.slice(1)
  )
}

export function parseQuickTask(
  input: string,
  contextDate = toISODate(new Date()),
  contextStartMin = 15 * 60,
): ParsedTask | null {
  const original = input.trim()
  if (!original) return null

  const text = fold(original)
  const context = fromISODate(contextDate)

  let deadlineTarget: Date | undefined
  for (const [name, index] of WEEKDAYS) {
    if (
      new RegExp(
        `\\bavant\\s+${name}\\b`,
      ).test(text)
    ) {
      deadlineTarget = nextWeekday(
        context,
        index,
      )
      break
    }
  }

  let target = context

  if (/\bdemain\b/.test(text)) {
    target = addDays(context, 1)
  }

  if (
    /\baujourd'hui\b|\baujourdhui\b/.test(
      text,
    )
  ) {
    target = context
  }

  for (const [name, index] of WEEKDAYS) {
    const usedAsDeadline =
      new RegExp(
        `\\bavant\\s+${name}\\b`,
      ).test(text)

    if (
      !usedAsDeadline &&
      new RegExp(
        `\\b${name}\\b`,
      ).test(text)
    ) {
      target = nextWeekday(
        context,
        index,
      )
      break
    }
  }

  if (
    deadlineTarget &&
    deadlineTarget.getTime() <
      target.getTime()
  ) {
    deadlineTarget = addDays(
      deadlineTarget,
      7,
    )
  }

  const date = toISODate(target)
  const day = weekdayIndex(target)

  // Remove clock constraints before looking for
  // a free-form duration. Otherwise "à 16h
  // pendant 45 min" would interpret 16h as
  // 16 hours.
  const durationText = text.replace(
    /\b(?:a|apres|avant)\s*\d{1,2}\s*h\s*\d{0,2}/g,
    ' ',
  )

  let durationMin = 60
  const explicitHours = text.match(
    /(?:pendant|durant)\s+(\d+)\s*h\s*(\d{1,2})?/,
  )
  const explicitMinutes = text.match(
    /(?:pendant|durant)\s+(\d+)\s*(?:min|minutes?)/,
  )
  const durationHours =
    explicitHours ??
    durationText.match(
      /(\d+)\s*h\s*(\d{1,2})?/,
    )
  const durationMinutes =
    explicitMinutes ??
    durationText.match(
      /(\d+)\s*(?:min|minutes?)/,
    )

  if (durationHours) {
    durationMin =
      Number(durationHours[1]) * 60 +
      Number(durationHours[2] || 0)
  } else if (durationMinutes) {
    durationMin =
      Number(durationMinutes[1])
  }

  durationMin = Math.max(
    15,
    Math.min(8 * 60, durationMin),
  )

  const after = text.match(
    /\bapres\s*(\d{1,2})\s*h\s*(\d{0,2})/,
  )
  const before = text.match(
    /\bavant\s*(\d{1,2})\s*h\s*(\d{0,2})/,
  )
  const exact = text.match(
    /\b(?:a|à)\s*(\d{1,2})\s*h\s*(\d{0,2})/,
  )

  let windowStartMin:
    | number
    | undefined
  let windowEndMin:
    | number
    | undefined
  let startMin = contextStartMin

  if (after) {
    windowStartMin = clock(
      after[1],
      after[2],
    )
    startMin = windowStartMin
  }

  if (before) {
    windowEndMin = clock(
      before[1],
      before[2],
    )
  }

  if (exact) {
    startMin = clock(
      exact[1],
      exact[2],
    )
  }

  let energy:
    | EnergyLevel
    | undefined

  if (/\bmatin\b/.test(text)) {
    energy = 'high'
    windowStartMin ??= 8 * 60
    windowEndMin ??= 12 * 60
  } else if (
    /\bsoir|soiree\b/.test(text)
  ) {
    energy = 'low'
    windowStartMin ??= 18 * 60
    windowEndMin ??= END_MIN
  }

  const category = inferCategory(text)
  const { kind, locked } =
    inferKind(text)

  const priority: Priority =
    /urgent|important|priorite haute/.test(
      text,
    )
      ? 'high'
      : 'medium'

  let deadlineDate:
    | string
    | undefined
  let deadlineDay:
    | number
    | undefined

  if (kind === 'fixed') {
    windowStartMin = undefined
    windowEndMin = undefined
  } else {
    deadlineTarget ??=
      addDays(target, 2)

    deadlineDate =
      toISODate(deadlineTarget)
    deadlineDay =
      weekdayIndex(deadlineTarget)
  }

  return {
    title: cleanTitle(original),
    date,
    day,
    startMin,
    durationMin,
    category,
    kind,
    locked,
    priority,
    energy,
    deadlineDay,
    deadlineDate,
    windowStartMin,
    windowEndMin,
  }
}
