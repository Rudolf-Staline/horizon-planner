export type Category =
  | 'course'
  | 'project'
  | 'personal'
  | 'focus'
  | 'routine'
  | 'admin'
  | 'neutral'

export type Priority = 'low' | 'medium' | 'high'
export type EventKind = 'fixed' | 'flexible'
export type EnergyLevel = 'low' | 'medium' | 'high'
export type PlannerEntityType = 'task' | 'calendar' | 'routine'
export type CalendarEventSource = 'manual' | 'google' | 'outlook' | 'ics'

export interface PlannerEvent {
  id: string
  title: string
  notes?: string
  /**
   * Concrete local calendar date (YYYY-MM-DD).
   * day remains the Monday-based weekday index used by the weekly planner.
   */
  date?: string
  day: number
  startMin: number
  durationMin: number
  category: Category

  /**
   * Explicit persistence identity. Older snapshots may omit it and are
   * migrated on load.
   */
  entityType?: PlannerEntityType
  source?: CalendarEventSource
  externalId?: string
  taskId?: string
  segmentIndex?: number
  segmentCount?: number

  projectId?: string
  routineId?: string
  virtual?: boolean
  priority?: Priority
  kind: EventKind
  locked?: boolean
  deadlineDay?: number
  deadlineDate?: string
  windowStartMin?: number
  windowEndMin?: number
  energy?: EnergyLevel
  splittable?: boolean
  minChunkMin?: number
  completed?: boolean
}

export interface Placement {
  day: number
  date?: string
  startMin: number
  durationMin: number
  score: number
}

export interface PlannerState {
  events: PlannerEvent[]
  selectedId: string | null
}
