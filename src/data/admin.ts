import { supabase } from '../lib/supabase'
import type { UserRole } from './profile'

export type AdminUser = {
  id: string
  email: string | null
  createdAt: string
  lastSignInAt: string | null
  emailConfirmedAt: string | null
  bannedUntil: string | null
  displayName: string | null
  role: UserRole
  timezone: string
  isCurrentAdmin: boolean
}

export type AdminStats = {
  profiles: number
  projects: number
  tasks: number
  routines: number
  calendarEvents: number
  plannedSegments: number
  snapshots: number
}

async function invokeAdmin<T>(
  body: Record<string, unknown>,
): Promise<T> {
  if (!supabase) {
    throw new Error('Supabase n’est pas configuré.')
  }

  const { data, error } = await supabase.functions.invoke(
    'admin-api',
    { body },
  )

  if (error) throw error

  if (
    data &&
    typeof data === 'object' &&
    'error' in data &&
    typeof data.error === 'string'
  ) {
    throw new Error(data.error)
  }

  return data as T
}

export async function listAdminUsers() {
  return invokeAdmin<{
    users: AdminUser[]
    page: number
    perPage: number
  }>({
    action: 'list_users',
    page: 1,
    perPage: 100,
  })
}

export async function loadAdminStats() {
  return invokeAdmin<AdminStats>({
    action: 'stats',
  })
}

export async function adminCreateUser(input: {
  email: string
  password: string
  displayName: string
}) {
  return invokeAdmin<{ userId: string }>({
    action: 'create_user',
    ...input,
  })
}

export async function adminSetRole(
  userId: string,
  role: UserRole,
) {
  return invokeAdmin<{ ok: true }>({
    action: 'set_role',
    userId,
    role,
  })
}

export async function adminSetSuspended(
  userId: string,
  suspended: boolean,
) {
  return invokeAdmin<{ ok: true }>({
    action: suspended ? 'ban_user' : 'unban_user',
    userId,
  })
}

export async function adminDeleteUser(userId: string) {
  return invokeAdmin<{ ok: true }>({
    action: 'delete_user',
    userId,
  })
}
