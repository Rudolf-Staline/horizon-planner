import { useRef, useState, type PointerEvent } from 'react'
import { END_MIN, PX_PER_MIN, SNAP_MINUTES, START_MIN } from '../domain/constants'
import type { PlannerEvent } from '../domain/types'
import { clamp, snapMinutes } from '../utils/time'

type Mode = 'move' | 'resize'

interface GestureState {
  id: string
  mode: Mode
  startClientY: number
  startClientX: number
  originalStart: number
  originalDuration: number
  originalDay: number
}

export function useEventGesture(
  event: PlannerEvent,
  columnWidth: number,
  onPreview: (patch: Partial<PlannerEvent> | null) => void,
  onCommit: (patch: Partial<PlannerEvent>) => void,
) {
  const gesture = useRef<GestureState | null>(null)
  const [active, setActive] = useState(false)

  const begin = (mode: Mode, e: PointerEvent) => {
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    gesture.current = {
      id: event.id,
      mode,
      startClientY: e.clientY,
      startClientX: e.clientX,
      originalStart: event.startMin,
      originalDuration: event.durationMin,
      originalDay: event.day,
    }
    setActive(true)
  }

  const move = (e: PointerEvent) => {
    const g = gesture.current
    if (!g) return

    const dy = e.clientY - g.startClientY
    const dx = e.clientX - g.startClientX
    const deltaMin = snapMinutes(dy / PX_PER_MIN)

    if (g.mode === 'resize') {
      const durationMin = clamp(g.originalDuration + deltaMin, SNAP_MINUTES, END_MIN - g.originalStart)
      onPreview({ durationMin })
      return
    }

    const dayDelta = Math.round(dx / columnWidth)
    const day = clamp(g.originalDay + dayDelta, 0, 6)
    const startMin = clamp(snapMinutes(g.originalStart + deltaMin), START_MIN, END_MIN - event.durationMin)
    onPreview({ day, startMin })
  }

  const end = () => {
    if (!gesture.current) return
    const g = gesture.current
    gesture.current = null
    setActive(false)
    onPreview(null)
    // Commit is issued by caller from last preview via data attributes/state.
    return g.mode
  }

  return { begin, move, end, active }
}
