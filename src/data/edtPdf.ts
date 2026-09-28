import type { PlannerEvent } from '../domain/types'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { weekdayIndex, fromISODate } from '../utils/date'
import {
  localDateTimeToIso,
  zonedDateMinutes,
  zonedDateToIso,
} from '../utils/timezone'

type PdfItem = {
  text: string
  x: number
  top: number
  width: number
  height: number
}

export type EtdSelectionGroup =
  | 'common'
  | 'td'
  | 'language'
  | 'cpv'

export type EtdCandidate = PlannerEvent & {
  selectionGroup: EtdSelectionGroup
  selectionLabel: string
  defaultSelected: boolean
}

export type EtdImportResult = {
  candidates: EtdCandidate[]
  weekStart: string
  weekLabel: string
}

const MONTHS: Record<string, number> = {
  jan: 0,
  janvier: 0,
  feb: 1,
  fev: 1,
  février: 1,
  mar: 2,
  mars: 2,
  avr: 3,
  avril: 3,
  mai: 4,
  juin: 5,
  jui: 6,
  juillet: 6,
  aou: 7,
  août: 7,
  sep: 8,
  sept: 8,
  septembre: 8,
  oct: 9,
  octobre: 9,
  nov: 10,
  novembre: 10,
  dec: 11,
  décembre: 11,
}

const DAY_HEADER_RE = /^(\d{1,2})-([a-zéû]+)$/i
const YEAR_RE = /20\d{2}\s*\/\s*20\d{2}/
const TIME_RE = /^(\d{1,2})h(\d{2})$/i
const GROUP_RE = /^GRP?TD\d/i
const LANGUAGE_RE = /^G\d{1,2}(?:\s|$)/i
const CPV_RE = /^C?PV\d{1,2}/i

function normalizeText(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.:;])/g, '$1')
    .replace(/([:;])(?=\S)/g, '$1 ')
    .replace(/--+/g, ' - ')
    .trim()
}

function normalizeAnchor(value: string) {
  return normalizeText(value)
    .replace(/^C\s+(PV\d)/i, 'C$1')
    .replace(/^PV(?=\d)/i, 'CPV')
}

function lineGroups(items: PdfItem[]) {
  const lines: PdfItem[][] = []

  for (const item of [...items].sort((a, b) => a.top - b.top || a.x - b.x)) {
    const line = lines.find((candidate) => Math.abs(candidate[0].top - item.top) <= 2.2)
    if (line) line.push(item)
    else lines.push([item])
  }

  return lines
    .map((line) => [...line].sort((a, b) => a.x - b.x))
    .sort((a, b) => a[0].top - b[0].top)
}

function lineText(line: PdfItem[]) {
  return normalizeText(line.map((item) => item.text).join(' '))
}

function itemTop(item: { transform: number[]; height?: number }, pageHeight: number) {
  return pageHeight - item.transform[5] - (item.height ?? Math.abs(item.transform[3]) ?? 8)
}

function monthIndex(value: string) {
  const key = value.toLocaleLowerCase('fr-FR').replace(/[.]/g, '')
  return MONTHS[key] ?? MONTHS[key.slice(0, 4)]
}

function academicYear(items: PdfItem[], month: number, now: Date) {
  const yearText = items.map((item) => item.text).join(' ').match(YEAR_RE)?.[0]
  if (yearText) {
    const [first, second] = yearText.split('/').map((value) => Number(value.trim()))
    return month >= 7 ? first : second
  }

  const year = now.getFullYear()
  const candidate = new Date(year, month, 15)
  const difference = candidate.getTime() - now.getTime()
  if (difference < -180 * 24 * 60 * 60 * 1000) return year + 1
  if (difference > 180 * 24 * 60 * 60 * 1000) return year - 1
  return year
}

function parseDateHeader(item: PdfItem, items: PdfItem[], now: Date) {
  const match = item.text.match(DAY_HEADER_RE)
  if (!match) return null
  const month = monthIndex(match[2])
  if (month === undefined) return null
  const year = academicYear(items, month, now)
  const date = new Date(year, month, Number(match[1]), 12)
  return { date: `${year}-${String(month + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`, x: item.x + item.width / 2 }
}

function nearestIndex(value: number, centers: number[]) {
  return centers.reduce((best, center, index) => Math.abs(center - value) < Math.abs(centers[best] - value) ? index : best, 0)
}

function subcolumnItems(items: PdfItem[], centers: number[]) {
  return centers
    .map((center) => items.filter((item) => Math.abs(item.x - center) < 85))
    .filter((group) => group.length > 0)
}

function scheduleDayIndex(item: PdfItem) {
  // The timetable's Thursday and Friday cells begin before their date headers;
  // using only the header centers would split prefixes such as "CPV1" from
  // the rest of their line. These content anchors match the grid columns.
  const contentCenters = [145, 213, 440, 646, 918]
  return nearestIndex(item.x, contentCenters)
}

function eventIdentity(date: string, startMin: number, title: string) {
  let hash = 2166136261
  for (const character of `${date}|${startMin}|${title}`) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return `edt-${date}-${startMin}-${(hash >>> 0).toString(36)}`
}

function selectionMeta(title: string) {
  const normalized = normalizeAnchor(title)
  const td = normalized.match(/^(GRPTD\d)/i)?.[1]?.toUpperCase()
  const language = normalized.match(/^(G\d{1,2})\b/i)?.[1]?.toUpperCase()
  const cpv = normalized.match(/^(CPV\d{1,2})/i)?.[1]?.toUpperCase()

  if (td) return { selectionGroup: 'td' as const, selectionLabel: td, defaultSelected: false }
  if (language) return { selectionGroup: 'language' as const, selectionLabel: language, defaultSelected: false }
  if (cpv) return { selectionGroup: 'cpv' as const, selectionLabel: cpv, defaultSelected: false }
  return { selectionGroup: 'common' as const, selectionLabel: 'Cours commun', defaultSelected: true }
}

function makeCandidate(
  title: string,
  date: string,
  startMin: number,
  durationMin: number,
  weekKey: string,
  timeZone: string,
  now: Date,
): EtdCandidate | null {
  const cleanTitle = normalizeAnchor(title)
  if (!cleanTitle || cleanTitle.length < 3) return null

  const startsAt = new Date(localDateTimeToIso(date, startMin, timeZone)).getTime()
  if (startsAt < now.getTime()) return null

  const meta = selectionMeta(cleanTitle)
  return {
    id: eventIdentity(date, startMin, cleanTitle),
    entityType: 'calendar',
    source: 'manual',
    externalId: `edt:${weekKey}:${eventIdentity(date, startMin, cleanTitle)}`,
    title: cleanTitle,
    date,
    day: weekdayIndex(fromISODate(date)),
    startMin,
    durationMin,
    category: 'course',
    kind: 'fixed',
    locked: true,
    selectionGroup: meta.selectionGroup,
    selectionLabel: meta.selectionLabel,
    defaultSelected: meta.defaultSelected,
  }
}

function slotForTop(top: number, slotCenters: number[]) {
  const index = nearestIndex(top, slotCenters)
  return Math.abs(top - slotCenters[index]) <= 70 ? index : -1
}

function extractPdfItems(content: { items: unknown[] }, pageHeight: number) {
  return content.items.flatMap((raw) => {
    if (!raw || typeof raw !== 'object' || !('str' in raw) || !('transform' in raw)) return []
    const item = raw as { str: string; transform: number[]; width?: number; height?: number }
    if (!item.str?.trim()) return []
    return [{
      text: item.str.trim(),
      x: item.transform[4],
      top: itemTop(item, pageHeight),
      width: item.width ?? 0,
      height: item.height ?? 0,
    }]
  })
}

function addCommonSpecialEvents(
  items: PdfItem[],
  dates: Array<{ date: string; x: number }>,
  timeZone: string,
  now: Date,
  weekKey: string,
  candidates: EtdCandidate[],
) {
  const monday = dates[nearestIndex(145, dates.map((item) => item.x))]?.date
  if (!monday) return

  const presentation = items.some((item) => /Présentation de GeorgiaTech/i.test(item.text))
  if (presentation) {
    const candidate = makeCandidate('Présentation de GeorgiaTech — Dr Bertrand Boussert — Amphi1', monday, 12 * 60 + 30, 60, weekKey, timeZone, now)
    if (candidate) candidates.push(candidate)
  }

  const activityItems = items.filter((item) => /Activités sportives et assosciatives/i.test(item.text))
  if (activityItems.length > 0) {
    const activityDate = dates[nearestIndex(700, dates.map((item) => item.x))]?.date
    if (activityDate) {
      const candidate = makeCandidate('Activités sportives et associatives', activityDate, 14 * 60, 225, weekKey, timeZone, now)
      if (candidate) candidates.push(candidate)
    }
  }
}

export async function parseEtdPdf(file: File, timeZone = 'Africa/Casablanca', now = new Date()): Promise<EtdImportResult> {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  GlobalWorkerOptions.workerSrc = typeof window === 'undefined'
    ? new URL('../../node_modules/pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
    : workerSrc
  const data = new Uint8Array(await file.arrayBuffer())
  const document = await getDocument({ data }).promise
  const candidates: EtdCandidate[] = []
  let allDates: Array<{ date: string; x: number }> = []

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1 })
    const items = extractPdfItems(await page.getTextContent(), viewport.height)
    const dates = items
      .map((item) => parseDateHeader(item, items, now))
      .filter((value): value is { date: string; x: number } => value !== null)
      .sort((a, b) => a.x - b.x)
    if (dates.length === 0) continue
    allDates = [...allDates, ...dates]

    const times = items
      .filter((item) => item.x < 80 && TIME_RE.test(item.text))
      .sort((a, b) => a.top - b.top)
      .map((item) => ({ ...item, match: item.text.match(TIME_RE)! }))
    const slots = []
    for (let index = 0; index + 1 < times.length; index += 2) {
      const startMin = Number(times[index].match[1]) * 60 + Number(times[index].match[2])
      const endMin = Number(times[index + 1].match[1]) * 60 + Number(times[index + 1].match[2])
      slots.push({ startMin, durationMin: endMin - startMin, center: (times[index].top + times[index + 1].top) / 2 })
    }
    const centers = slots.map((slot) => slot.center)
    const weekKey = dates[0].date

    for (const [dayIndex, day] of dates.entries()) {
      for (const [slotIndex, slot] of slots.entries()) {
        const dayItems = items.filter((item) => {
          const itemDay = scheduleDayIndex(item)
          const isSpecialActivity = /Activités sportives|assosciatives/i.test(item.text)
          return itemDay === dayIndex
            && slotForTop(item.top, centers) === slotIndex
            && item.x >= 78
            && item.top >= 100
            && !isSpecialActivity
        })
        if (dayItems.length === 0) continue

        if (dayIndex === 0) {
          const lines = lineGroups(dayItems)
          const usableLines = lines.filter((line) => !/Soutien/i.test(lineText(line)))
          const title = usableLines.map(lineText).filter((line) => !/^(CM3|CM4)$/i.test(line)).join(' ')
          const candidate = makeCandidate(title, day.date, slot.startMin, slot.durationMin, weekKey, timeZone, now)
          if (candidate) candidates.push(candidate)
          continue
        }

        const centersForDay = dayIndex === 2
          ? [392, 487]
          : dayIndex === 3
            ? [579, 713]
            : dayIndex === 4
              ? [851, 986]
              : [213]

        for (const columnItems of subcolumnItems(dayItems, centersForDay)) {
          const lines = lineGroups(columnItems)

          if (dayIndex === 1 || dayIndex === 2) {
            for (const line of lines) {
              const title = normalizeAnchor(lineText(line))
              if (!GROUP_RE.test(title) && !LANGUAGE_RE.test(title)) continue
              const candidate = makeCandidate(title, day.date, slot.startMin, slot.durationMin, weekKey, timeZone, now)
              if (candidate) candidates.push(candidate)
            }
            continue
          }

          let current: string[] = []
          const flush = () => {
            const candidate = makeCandidate(current.join(' '), day.date, slot.startMin, slot.durationMin, weekKey, timeZone, now)
            if (candidate) candidates.push(candidate)
            current = []
          }
          for (const line of lines) {
            const value = normalizeAnchor(lineText(line))
            if (CPV_RE.test(value)) flush()
            current.push(value)
          }
          flush()
        }
      }
    }

    addCommonSpecialEvents(items, dates, timeZone, now, weekKey, candidates)
  }

  const unique = [...new Map(candidates.map((candidate) => [candidate.id, candidate])).values()]
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.startMin - b.startMin || a.title.localeCompare(b.title))
  const weekStart = allDates[0]?.date ?? unique[0]?.date ?? zonedDateToIso(now, timeZone)
  return {
    candidates: unique,
    weekStart,
    weekLabel: allDates.length > 0 ? `${allDates[0].date} → ${allDates.at(-1)?.date}` : file.name,
  }
}
