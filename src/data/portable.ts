import type { PlannerEvent } from '../domain/types'
import { supabase } from '../lib/supabase'
import { localDateTimeToIso } from '../utils/timezone'

export type HorizonBackup = {
  format: 'horizon-backup'
  version: 1
  exportedAt: string
  profile: Record<string, unknown> | null
  projects: Record<string, unknown>[]
  tasks: Record<string, unknown>[]
  taskConstraints: Record<string, unknown>[]
  routines: Record<string, unknown>[]
  routineExceptions: Record<string, unknown>[]
  calendarSources: Record<string, unknown>[]
  calendarEvents: Record<string, unknown>[]
  plannedSegments: Record<string, unknown>[]
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase n’est pas configuré.')
  return supabase
}

async function rows(table: string, userId: string) {
  const { data, error } = await requireSupabase()
    .from(table)
    .select('*')
    .eq('user_id', userId)

  if (error) throw error
  return (data ?? []) as Record<string, unknown>[]
}

export async function exportAccountBackup(userId: string): Promise<HorizonBackup> {
  const client = requireSupabase()
  const [profileResult, projects, tasks, taskConstraints, routines, routineExceptions, calendarSources, calendarEvents, plannedSegments] = await Promise.all([
    client.from('profiles').select('*').eq('id', userId).single(),
    rows('projects', userId),
    rows('tasks', userId),
    rows('task_constraints', userId),
    rows('routines', userId),
    rows('routine_exceptions', userId),
    rows('calendar_sources', userId),
    rows('calendar_events', userId),
    rows('planned_segments', userId),
  ])

  if (profileResult.error) throw profileResult.error

  return {
    format: 'horizon-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: (profileResult.data ?? null) as Record<string, unknown> | null,
    projects,
    tasks,
    taskConstraints,
    routines,
    routineExceptions,
    calendarSources,
    calendarEvents,
    plannedSegments,
  }
}

export async function importAccountBackup(userId: string, backup: HorizonBackup) {
  if (backup.format !== 'horizon-backup' || backup.version !== 1) {
    throw new Error('Ce fichier n’est pas une sauvegarde Horizon reconnue.')
  }

  const client = requireSupabase()
  const upsertRows = async (table: string, values: Record<string, unknown>[]) => {
    if (values.length === 0) return
    const sanitized = values.map((value) => ({ ...value, user_id: userId }))
    const { error } = await client.from(table).upsert(sanitized)
    if (error) throw error
  }

  if (backup.profile) {
    const { error } = await client.from('profiles').update({
      display_name: backup.profile.display_name ?? null,
      timezone: backup.profile.timezone ?? undefined,
      week_starts_on: backup.profile.week_starts_on ?? undefined,
      workday_start_min: backup.profile.workday_start_min ?? undefined,
      workday_end_min: backup.profile.workday_end_min ?? undefined,
      active_days: backup.profile.active_days ?? undefined,
      default_duration_min: backup.profile.default_duration_min ?? undefined,
      focus_block_min: backup.profile.focus_block_min ?? undefined,
      buffer_min: backup.profile.buffer_min ?? undefined,
      energy_preference: backup.profile.energy_preference ?? undefined,
      planning_step_min: backup.profile.planning_step_min ?? undefined,
      notifications_enabled: backup.profile.notifications_enabled ?? undefined,
      reminder_lead_min: backup.profile.reminder_lead_min ?? undefined,
    }).eq('id', userId)
    if (error) throw error
  }

  await upsertRows('projects', backup.projects)
  await upsertRows('tasks', backup.tasks)
  await upsertRows('task_constraints', backup.taskConstraints)
  await upsertRows('routines', backup.routines)
  await upsertRows('routine_exceptions', backup.routineExceptions)
  await upsertRows('calendar_sources', backup.calendarSources ?? [])
  await upsertRows('calendar_events', backup.calendarEvents)
  await upsertRows('planned_segments', backup.plannedSegments)
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function downloadJsonBackup(backup: HorizonBackup) {
  downloadFile(
    `horizon-backup-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(backup, null, 2),
    'application/json;charset=utf-8',
  )
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

function icsDate(event: PlannerEvent, timeZone: string) {
  const date = event.date ?? new Date().toISOString().slice(0, 10)
  return localDateTimeToIso(date, event.startMin, timeZone)
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

export function plannerEventsToIcs(events: PlannerEvent[], timeZone = 'UTC') {
  const body = events.filter((event) => !event.virtual && event.date).map((event) => {
    const start = icsDate(event, timeZone)
    const end = icsDate({ ...event, startMin: event.startMin + event.durationMin }, timeZone)
    return [
      'BEGIN:VEVENT',
      `UID:${escapeIcs(event.id)}@horizon`,
      `DTSTAMP:${start}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${escapeIcs(event.title)}`,
      'END:VEVENT',
    ].join('\r\n')
  })

  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Horizon Planner//FR', ...body, 'END:VCALENDAR', ''].join('\r\n')
}

export function downloadPlannerIcs(events: PlannerEvent[], timeZone = 'UTC') {
  downloadFile(
    `horizon-calendar-${new Date().toISOString().slice(0, 10)}.ics`,
    plannerEventsToIcs(events, timeZone),
    'text/calendar;charset=utf-8',
  )
}

function unfoldIcs(content: string) {
  return content.replace(/\r?\n[ \t]/g, '').split(/\r?\n/)
}

function unescapeIcs(value: string) {
  return value.replace(/\\n/gi, '\n').replace(/\\([\\;,])/g, '$1')
}

function parseIcsDate(value: string) {
  const [keyPart, ...rest] = value.split(':')
  const raw = rest.join(':')
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T09:00:00.000Z`
  const normalized = raw.replace(/Z$/, '')
  if (!/^\d{8}T\d{6}$/.test(normalized)) throw new Error('Date ICS invalide.')
  const tzid = keyPart.split(';').find((parameter) => parameter.toUpperCase().startsWith('TZID='))?.slice(5)
  if (tzid && !raw.endsWith('Z')) {
    const date = `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}`
    const minutes = Number(normalized.slice(9, 11)) * 60 + Number(normalized.slice(11, 13))
    return localDateTimeToIso(date, minutes, tzid)
  }
  return `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}T${normalized.slice(9, 11)}:${normalized.slice(11, 13)}:${normalized.slice(13, 15)}Z`
}

export function parseIcsEvents(content: string): Array<{ externalId: string; title: string; startsAt: string; endsAt: string }> {
  const events: Array<{ externalId: string; title: string; startsAt: string; endsAt: string }> = []
  let current: Partial<typeof events[number]> | null = null

  for (const line of unfoldIcs(content)) {
    if (line === 'BEGIN:VEVENT') current = {}
    else if (line === 'END:VEVENT' && current?.externalId && current.title && current.startsAt && current.endsAt) {
      events.push(current as typeof events[number])
      current = null
    } else if (current) {
      const [rawKey, ...rest] = line.split(':')
      const value = unescapeIcs(rest.join(':'))
      const key = rawKey.split(';')[0]
      if (key === 'UID') current.externalId = value
      if (key === 'SUMMARY') current.title = value
      if (key === 'DTSTART') current.startsAt = new Date(parseIcsDate(line)).toISOString()
      if (key === 'DTEND') current.endsAt = new Date(parseIcsDate(line)).toISOString()
    }
  }

  return events
}

export function downloadFileContent(file: File) {
  return file.text()
}
