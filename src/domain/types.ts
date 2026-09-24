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
  day: number
  startMin: number
  durationMin: number
  category: Category
  priority?: Priority
  kind: EventKind

  /**
   * A locked event is not draggable/resizable by direct calendar gestures.
   * This is stronger than kind="fixed": fixed means "do not auto-replan";
   * locked means "do not move without first unlocking".
   */
  locked?: boolean

  /**
   * Latest day accepted by the scheduler (0..6 in the current weekly model).
   */
  deadlineDay?: number

  /**
   * Daily admissible scheduling window.
   */
  windowStartMin?: number
  windowEndMin?: number

  /**
   * Planning preferences used only for scoring admissible slots.
   */
  energy?: EnergyLevel

  /**
   * A flexible task may be divided if no contiguous slot fits.
   */
  splittable?: boolean
  minChunkMin?: number

  completed?: boolean
}

export interface Placement {
  day: number
  startMin: number
  durationMin: number
  score: number
}

export interface PlannerState {
  events: PlannerEvent[]
  selectedId: string | null
}
