export type EnergyPreference = 'low' | 'balanced' | 'high'

export type PlannerPreferences = {
  timezone: string
  weekStartsOn: number
  workdayStartMin: number
  workdayEndMin: number
  activeDays: number[]
  defaultDurationMin: number
  focusBlockMin: number
  bufferMin: number
  energyPreference: EnergyPreference
  planningStepMin: number
  notificationsEnabled: boolean
  reminderLeadMin: number
}

export const DEFAULT_PLANNER_PREFERENCES: PlannerPreferences = {
  timezone: 'UTC',
  weekStartsOn: 1,
  workdayStartMin: 7 * 60,
  workdayEndMin: 22 * 60,
  activeDays: [0, 1, 2, 3, 4],
  defaultDurationMin: 60,
  focusBlockMin: 50,
  bufferMin: 10,
  energyPreference: 'balanced',
  planningStepMin: 15,
  notificationsEnabled: true,
  reminderLeadMin: 10,
}

export function minutesToTime(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

export function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return Math.max(0, Math.min(1440, hours * 60 + minutes))
}

export function validatePlannerPreferences(preferences: PlannerPreferences) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: preferences.timezone }).format()
  } catch {
    throw new Error('Le fuseau horaire saisi est invalide.')
  }

  if (preferences.workdayEndMin <= preferences.workdayStartMin) {
    throw new Error('La fin de la journée doit être postérieure à son début.')
  }
  if (preferences.activeDays.length === 0 || preferences.activeDays.some((day) => day < 0 || day > 6)) {
    throw new Error('Sélectionnez au moins un jour actif.')
  }
  if (preferences.defaultDurationMin < 15 || preferences.defaultDurationMin > 1440) {
    throw new Error('La durée par défaut doit être comprise entre 15 et 1440 minutes.')
  }
  if (preferences.focusBlockMin < 15 || preferences.focusBlockMin > 240) {
    throw new Error('Le bloc de concentration doit être compris entre 15 et 240 minutes.')
  }
  if (preferences.bufferMin < 0 || preferences.bufferMin > 120) {
    throw new Error('La marge doit être comprise entre 0 et 120 minutes.')
  }
  if (![5, 10, 15, 30, 60].includes(preferences.planningStepMin)) {
    throw new Error('Le pas de planification est invalide.')
  }
  if (preferences.reminderLeadMin < 0 || preferences.reminderLeadMin > 120) {
    throw new Error('Le délai de rappel doit être compris entre 0 et 120 minutes.')
  }
}
