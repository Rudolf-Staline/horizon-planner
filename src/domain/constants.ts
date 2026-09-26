import type { Category } from './types'

export const START_MIN = 7 * 60
export const END_MIN = 22 * 60
export const DAY_MINUTES = END_MIN - START_MIN
export const SNAP_MINUTES = 15
export const SLOT_HEIGHT = 24
export const PX_PER_MIN = SLOT_HEIGHT / SNAP_MINUTES

export const CATEGORY_LABEL: Record<Category, string> = {
  course: 'Cours',
  project: 'Projet',
  personal: 'Personnel',
  focus: 'Focus',
  routine: 'Routine',
  admin: 'Administratif',
  neutral: 'Autre',
}
