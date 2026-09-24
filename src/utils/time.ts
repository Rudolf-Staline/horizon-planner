import { END_MIN, SNAP_MINUTES, START_MIN } from '../domain/constants'

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export const snapMinutes = (minutes: number) => Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES

export const formatTime = (minutes: number) => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export const parseTime = (value: string, fallback: number) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return fallback

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return fallback

  return hours * 60 + minutes
}

export const clampStart = (startMin: number, durationMin: number) =>
  clamp(startMin, START_MIN, END_MIN - durationMin)
