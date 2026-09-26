import type {
  Category,
  Priority,
} from '../domain/types'
import { supabase } from '../lib/supabase'

export type InboxTask = {
  id: string
  title: string
  notes: string | null
  category: Category
  priority: Priority
  durationMin: number
  projectId: string | null
  deadlineDate: string | null
  createdAt: string
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase n’est pas configuré.')
  }

  return supabase
}

export async function listInboxTasks(
  userId: string,
): Promise<InboxTask[]> {
  const client = requireSupabase()

  const [tasksResult, constraintsResult] =
    await Promise.all([
      client
        .from('tasks')
        .select(
          'id,title,notes,category,priority,duration_min,project_id,created_at',
        )
        .eq('user_id', userId)
        .eq('status', 'open')
        .order('created_at', {
          ascending: false,
        }),
      client
        .from('task_constraints')
        .select(
          'task_id,deadline_date',
        )
        .eq('user_id', userId),
    ])

  if (tasksResult.error) {
    throw tasksResult.error
  }
  if (constraintsResult.error) {
    throw constraintsResult.error
  }

  const deadlineByTask = new Map(
    (constraintsResult.data ?? []).map(
      (constraint) => [
        constraint.task_id,
        constraint.deadline_date,
      ],
    ),
  )

  return (tasksResult.data ?? []).map(
    (task) => ({
      id: task.id,
      title: task.title,
      notes: task.notes ?? null,
      category: task.category,
      priority: task.priority,
      durationMin:
        task.duration_min,
      projectId:
        task.project_id ?? null,
      deadlineDate:
        deadlineByTask.get(task.id) ??
        null,
      createdAt:
        task.created_at,
    }),
  )
}

export async function createInboxTask(
  userId: string,
  input: {
    title: string
    notes?: string
    category: Category
    priority: Priority
    durationMin: number
    projectId?: string
    deadlineDate?: string
  },
) {
  const client = requireSupabase()

  const { data, error } = await client
    .from('tasks')
    .insert({
      user_id: userId,
      project_id:
        input.projectId || null,
      title: input.title,
      notes:
        input.notes?.trim() || null,
      category: input.category,
      priority: input.priority,
      kind: 'flexible',
      duration_min:
        input.durationMin,
      locked: false,
      status: 'open',
      completed_at: null,
    })
    .select('id')
    .single()

  if (error) throw error

  if (input.deadlineDate) {
    const { error: constraintError } =
      await client
        .from('task_constraints')
        .insert({
          task_id: data.id,
          user_id: userId,
          deadline_date:
            input.deadlineDate,
          splittable: false,
        })

    if (constraintError) {
      await client
        .from('tasks')
        .delete()
        .eq('id', data.id)
      throw constraintError
    }
  }

  return data.id as string
}

export async function deleteInboxTask(
  taskId: string,
) {
  const client = requireSupabase()

  const { error } = await client
    .from('tasks')
    .delete()
    .eq('id', taskId)

  if (error) throw error
}

export async function completeInboxTask(
  taskId: string,
) {
  const client = requireSupabase()

  const { error } = await client
    .from('tasks')
    .update({
      status: 'completed',
      completed_at:
        new Date().toISOString(),
    })
    .eq('id', taskId)

  if (error) throw error
}

export async function markInboxTaskPlanned(
  taskId: string,
) {
  const client = requireSupabase()

  const { error } = await client
    .from('tasks')
    .update({
      status: 'planned',
      completed_at: null,
    })
    .eq('id', taskId)

  if (error) throw error
}
