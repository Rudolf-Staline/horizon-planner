import type { PlannerEvent } from '../domain/types'
import initialSheets from './fixtures/edt-s7-2026-2027.json'

export type EdtSheet = { name: string; cells: Record<string, string>; merges: string[] }
export type EdtEntry = PlannerEvent & { groups: string[]; sheet: string; cell: string }
export type EdtSnapshot = { entries: EdtEntry[]; warnings: string[] }
export const semesterKey = 's7-2026-2027'
export const groupFamilies = ['TD', 'LANG', 'CR', 'DI', 'CPV'] as const
export type EdtGroups = Record<typeof groupFamilies[number], string>
export const emptyGroups: EdtGroups = { TD: '', LANG: '', CR: '', DI: '', CPV: '' }
const slots = [[5, 11, 510, 615], [12, 18, 630, 735], [19, 25, 840, 945], [26, 32, 960, 1065]]

export function parseEdtSheets(sheets: EdtSheet[]): EdtSnapshot {
  const entries: EdtEntry[] = [], warnings: string[] = []
  for (const sheet of sheets) {
    const dates = Object.entries(sheet.cells).filter(([cell, value]) => /^[A-Z]+4$/.test(cell) && /^\d{4}-\d{2}-\d{2}$/.test(value))
    for (const [dateCell, originalDate] of dates) {
      const dateCol = dateCell.replace('4', ''), col = dateCol.charCodeAt(0)
      let date = originalDate
      if (date.startsWith('2026-01-')) {
        date = date.replace('2026-', '2027-')
        warnings.push(`${sheet.name} : année corrigée de 2026 à 2027.`)
      }
      if (/1\s*-\s*5\s*fév/i.test(sheet.name)) {
        const day = (col - 66) / 2 + 1
        date = `2027-02-${String(day).padStart(2, '0')}`
        warnings.push(`${sheet.name} : dates corrigées selon le titre de la feuille (1–5 février 2027).`)
      }
      for (let column = col; column <= col + 1; column++) {
        const letter = String.fromCharCode(column)
        for (const [first, last, start, end] of slots) {
          for (let row = first; row <= last; row++) {
            const cell = `${letter}${row}`, raw = sheet.cells[cell]
            if (!raw?.trim()) continue
            const text = raw.replace(/\s+/g, ' ').trim()
            const groups = [...text.matchAll(/GRP\s*TD\s*(\d+)|\bG(\d+)\s*(?:ANG|FR)\b|\b(CR|DI|CPV)\s*-?\s*(\d+)/gi)].map(m => m[1] ? `TD${m[1]}` : m[2] ? `LANG${m[2]}` : `${m[3].toUpperCase()}${m[4]}`)
            if (/^(?:DI|CR|CPV)\s*-?\s*\d+\s*-?\s*$/.test(text)) continue
            let startMin = start, endMin = end
            const explicit = text.match(/(\d{1,2})h\s*(\d{2})?\s*(?:à|a|[-–])\s*(\d{1,2})h\s*(\d{2})?/i)
            if (explicit) { startMin = Number(explicit[1]) * 60 + Number(explicit[2] || 0); endMin = Number(explicit[3]) * 60 + Number(explicit[4] || 0) }
            else {
              const merge = sheet.merges.find(m => m.split(':')[0] === cell)
              const endRow = merge ? Number(merge.split(':')[1]?.match(/\d+/)?.[0] || row) : row
              const through = slots.filter(s => s[0] > first && s[0] <= endRow).at(-1)
              if (through) endMin = through[3]
            }
            if (endMin <= startMin || endMin > 1440) { warnings.push(`${sheet.name} ${cell} : horaire invalide, séance ignorée.`); continue }
            const externalId = `edt:${semesterKey}:${sheet.name}:${cell}`
            entries.push({ id: externalId, externalId, entityType: 'calendar', source: 'manual', title: text, notes: `EDT S7 · ${sheet.name} · ${cell}\n${raw}`, date, day: (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7, startMin, durationMin: endMin - startMin, category: 'course', kind: 'fixed', locked: true, groups: [...new Set(groups)], sheet: sheet.name, cell })
          }
        }
      }
    }
  }
  if (!entries.length) throw new Error('Aucune séance reconnue. Utilisez le classeur EDT S7 avec les dates en ligne 4 et les créneaux en colonne A.')
  return { entries, warnings: [...new Set(warnings)] }
}
export const initialEdt = parseEdtSheets(initialSheets as unknown as EdtSheet[])
export function selectEdt(entries: EdtEntry[], groups: EdtGroups) {
  return entries.filter(e => !e.groups.length || e.groups.some(g => groupFamilies.some(f => g === `${f}${groups[f]}`)))
}
export function edtChanges(existing: PlannerEvent[], incoming: PlannerEvent[]) {
  const previous = new Map(existing.filter(e => e.externalId?.startsWith(`edt:${semesterKey}:`)).map(e => [e.externalId!, e]))
  const next = new Set(incoming.map(e => e.externalId!))
  let added = 0, changed = 0
  for (const e of incoming) {
    const old = previous.get(e.externalId!)
    if (!old) added++
    else if (old.title !== e.title || old.date !== e.date || old.startMin !== e.startMin || old.durationMin !== e.durationMin) changed++
  }
  return { added, changed, removed: [...previous.keys()].filter(k => !next.has(k)).length }
}
export async function readEdtExcel(file: Blob): Promise<EdtSnapshot> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
  return parseEdtSheets(workbook.SheetNames.map(name => {
    const sheet = workbook.Sheets[name], cells: Record<string, string> = {}
    for (const key of Object.keys(sheet)) {
      if (key.startsWith('!')) continue
      const value = sheet[key].v
      if (value != null) cells[key] = value instanceof Date ? `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}` : String(value)
    }
    return { name, cells, merges: (sheet['!merges'] ?? []).map(m => XLSX.utils.encode_range(m)) }
  }))
}

export function reconcileSemester(existing: PlannerEvent[], incoming: PlannerEvent[]): PlannerEvent[] {
  const byKey = new Map(existing.map(event => [event.externalId, event]))
  const unique = new Map(incoming.map(event => [event.externalId, event]))
  return [
    ...existing.filter(event => !event.externalId?.startsWith(`edt:${semesterKey}:`)),
    ...[...unique.values()].map(event => ({ ...event, id: byKey.get(event.externalId)?.id ?? crypto.randomUUID() })),
  ]
}
