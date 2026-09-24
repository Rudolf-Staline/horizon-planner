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

export interface PlannerEvent {
  id: string
  title: string
  day: number
  startMin: number
  durationMin: number
  category: Category
  priority?: Priority
  kind: EventKind
  deadlineDay?: number
  windowStartMin?: number
  windowEndMin?: number
  completed?: boolean
}

export interface PlannerState {
  events: PlannerEvent[]
  selectedId: string | null
}
