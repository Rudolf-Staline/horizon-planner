import { supabase } from '../lib/supabase'

export type Project = {
  id: string
  name: string
  description: string | null
  color: string | null
  archived: boolean
  createdAt: string
  updatedAt: string
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase n’est pas configuré.')
  }
  return supabase
}

export async function listProjects(
  userId: string,
): Promise<Project[]> {
  const client = requireSupabase()

  const { data, error } = await client
    .from('projects')
    .select(
      'id,name,description,color,archived,created_at,updated_at',
    )
    .eq('user_id', userId)
    .order('archived', {
      ascending: true,
    })
    .order('updated_at', {
      ascending: false,
    })

  if (error) throw error

  return (data ?? []).map((project) => ({
    id: project.id,
    name: project.name,
    description:
      project.description ?? null,
    color: project.color ?? null,
    archived: project.archived,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
  }))
}

export async function createProject(
  userId: string,
  input: {
    name: string
    description?: string
    color?: string
  },
) {
  const client = requireSupabase()

  const { data, error } = await client
    .from('projects')
    .insert({
      user_id: userId,
      name: input.name,
      description:
        input.description?.trim() || null,
      color:
        input.color || '#FF6200',
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id as string
}

export async function updateProject(
  projectId: string,
  patch: {
    name?: string
    description?: string | null
    color?: string | null
    archived?: boolean
  },
) {
  const client = requireSupabase()

  const payload: Record<string, unknown> = {}

  if (patch.name !== undefined) {
    payload.name = patch.name
  }
  if (patch.description !== undefined) {
    payload.description = patch.description
  }
  if (patch.color !== undefined) {
    payload.color = patch.color
  }
  if (patch.archived !== undefined) {
    payload.archived = patch.archived
  }

  const { error } = await client
    .from('projects')
    .update(payload)
    .eq('id', projectId)

  if (error) throw error
}

export async function deleteProject(
  projectId: string,
) {
  const client = requireSupabase()

  const [
    tasks,
    events,
    routines,
  ] = await Promise.all([
    client
      .from('tasks')
      .update({ project_id: null })
      .eq('project_id', projectId),
    client
      .from('calendar_events')
      .update({ project_id: null })
      .eq('project_id', projectId),
    client
      .from('routines')
      .update({ project_id: null })
      .eq('project_id', projectId),
  ])

  for (const result of [
    tasks,
    events,
    routines,
  ]) {
    if (result.error) {
      throw result.error
    }
  }

  const { error } = await client
    .from('projects')
    .delete()
    .eq('id', projectId)

  if (error) throw error
}
