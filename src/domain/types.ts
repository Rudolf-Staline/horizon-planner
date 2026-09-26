export type Category =
  | 'course'
  | 'project'
  | 'personal'
  | 'focus'
  | 'routine'
  | 'admin'
  | 'flexible'
  | 'neutral'

export type Priority = 'low' | 'medium' | 'high'
export type EventKind = 'fixed' | 'flexible'
export type EnergyLevel = 'low' | 'medium' | 'high'

export interface PlannerEvent {
  id: string
  title: string
  /**
   * Concrete local calendar date (YYYY-MM-DD).
   * day remains the Monday-based weekday index used by the weekly planner.
   */
  date?: string
  day: number
  startMin: number
  durationMin: number
  category: Category
  projectId?: string
  routineId?: string
  virtual?: boolean
  priority?: Priority
  kind: EventKind
  locked?: boolean
  deadlineDay?: number
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
