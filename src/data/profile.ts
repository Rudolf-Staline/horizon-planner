import { supabase } from '../lib/supabase'
import {
  DEFAULT_PLANNER_PREFERENCES,
  type EnergyPreference,
  type PlannerPreferences,
} from '../domain/preferences'

export type UserRole = 'user' | 'admin'

export type UserProfile = {
  id: string
  displayName: string | null
  timezone: string
  role: UserRole
  preferences: PlannerPreferences
}

export async function loadOwnProfile(
  userId: string,
): Promise<UserProfile | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, timezone, week_starts_on, workday_start_min, workday_end_min, active_days, default_duration_min, focus_block_min, buffer_min, energy_preference, planning_step_min, notifications_enabled, reminder_lead_min, role')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    id: data.id,
    displayName: data.display_name,
    timezone: data.timezone,
    role: data.role === 'admin' ? 'admin' : 'user',
    preferences: {
      ...DEFAULT_PLANNER_PREFERENCES,
      timezone: data.timezone ?? DEFAULT_PLANNER_PREFERENCES.timezone,
      weekStartsOn: data.week_starts_on ?? DEFAULT_PLANNER_PREFERENCES.weekStartsOn,
      workdayStartMin: data.workday_start_min ?? DEFAULT_PLANNER_PREFERENCES.workdayStartMin,
      workdayEndMin: data.workday_end_min ?? DEFAULT_PLANNER_PREFERENCES.workdayEndMin,
      activeDays: data.active_days ?? DEFAULT_PLANNER_PREFERENCES.activeDays,
      defaultDurationMin: data.default_duration_min ?? DEFAULT_PLANNER_PREFERENCES.defaultDurationMin,
      focusBlockMin: data.focus_block_min ?? DEFAULT_PLANNER_PREFERENCES.focusBlockMin,
      bufferMin: data.buffer_min ?? DEFAULT_PLANNER_PREFERENCES.bufferMin,
      energyPreference: (data.energy_preference ?? DEFAULT_PLANNER_PREFERENCES.energyPreference) as EnergyPreference,
      planningStepMin: data.planning_step_min ?? DEFAULT_PLANNER_PREFERENCES.planningStepMin,
      notificationsEnabled: data.notifications_enabled ?? DEFAULT_PLANNER_PREFERENCES.notificationsEnabled,
      reminderLeadMin: data.reminder_lead_min ?? DEFAULT_PLANNER_PREFERENCES.reminderLeadMin,
    },
  }
}

export async function updateDisplayName(
  userId: string,
  displayName: string,
) {
  if (!supabase) {
    throw new Error('Supabase n’est pas configuré.')
  }

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', userId)

  if (error) throw error

  const { error: metadataError } =
    await supabase.auth.updateUser({
      data: {
        display_name: displayName,
      },
    })

  if (metadataError) throw metadataError
}


export async function syncProfileTimezone(
  userId: string,
  timezone: string,
) {
  if (!supabase) return

  const { error } = await supabase
    .from('profiles')
    .update({ timezone })
    .eq('id', userId)

  if (error) throw error
}

export async function updatePlannerPreferences(
  userId: string,
  preferences: PlannerPreferences,
) {
  if (!supabase) {
    throw new Error('Supabase n’est pas configuré.')
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      timezone: preferences.timezone,
      week_starts_on: preferences.weekStartsOn,
      workday_start_min: preferences.workdayStartMin,
      workday_end_min: preferences.workdayEndMin,
      active_days: preferences.activeDays,
      default_duration_min: preferences.defaultDurationMin,
      focus_block_min: preferences.focusBlockMin,
      buffer_min: preferences.bufferMin,
      energy_preference: preferences.energyPreference,
      planning_step_min: preferences.planningStepMin,
      notifications_enabled: preferences.notificationsEnabled,
      reminder_lead_min: preferences.reminderLeadMin,
    })
    .eq('id', userId)

  if (error) throw error
}
