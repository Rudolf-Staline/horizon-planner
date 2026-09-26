import { useRef, useState, type PointerEvent } from 'react'
import { GripHorizontal, Lock, Move } from 'lucide-react'
import { PX_PER_MIN, SNAP_MINUTES, START_MIN } from '../domain/constants'
import type { PlannerEvent } from '../domain/types'
import { clamp, formatTime, snapMinutes } from '../utils/time'

interface Props {
  event: PlannerEvent
  columnWidth: number
  maxDay?: number
  selected: boolean
  onSelect: () => void
  onChange: (patch: Partial<PlannerEvent>) => void
}

type Gesture = {
  mode: 'move' | 'resize'
  startX: number
  startY: number
  originalDay: number
  originalStart: number
  originalDuration: number
}

export function EventCard({
  event,
  columnWidth,
  maxDay = 6,
  selected,
  onSelect,
  onChange,
}: Props) {
  const [preview, setPreview] =
    useState<Partial<PlannerEvent> | null>(null)
  const [dragging, setDragging] = useState(false)
  const gesture = useRef<Gesture | null>(null)
  const live = { ...event, ...(preview ?? {}) }

  const begin = (
    mode: Gesture['mode'],
    e: PointerEvent,
  ) => {
    e.stopPropagation()
    onSelect()

    if (event.locked) return

    ;(e.currentTarget as HTMLElement).setPointerCapture(
      e.pointerId,
    )

    gesture.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      originalDay: event.day,
      originalStart: event.startMin,
      originalDuration: event.durationMin,
    }
    setDragging(true)
  }

  const move = (e: PointerEvent) => {
    const g = gesture.current
    if (!g) return

    const dy = e.clientY - g.startY
    const dx = e.clientX - g.startX
    const deltaMin = snapMinutes(dy / PX_PER_MIN)

    if (g.mode === 'resize') {
      const durationMin = clamp(
        g.originalDuration + deltaMin,
        SNAP_MINUTES,
        22 * 60 - g.originalStart,
      )
      setPreview({ durationMin })
      return
    }

    const day = clamp(
      g.originalDay + Math.round(dx / columnWidth),
      0,
      maxDay,
    )

    const startMin = clamp(
      snapMinutes(g.originalStart + deltaMin),
      START_MIN,
      22 * 60 - event.durationMin,
    )

    setPreview({ day, startMin })
  }

  const end = (e: PointerEvent) => {
    if (!gesture.current) return

    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(
        e.pointerId,
      )
    } catch {}

    if (preview) onChange(preview)
    gesture.current = null
    setPreview(null)
    setDragging(false)
  }

  const top = (live.startMin - START_MIN) * PX_PER_MIN
  const height = Math.max(live.durationMin * PX_PER_MIN, 34)
  const left = live.day * columnWidth

  return (
    <article
      className={[
        'event-card',
        `category-${live.category}`,
        selected ? 'selected' : '',
        dragging ? 'dragging' : '',
        event.locked ? 'locked' : '',
      ].filter(Boolean).join(' ')}
      style={{
        top,
        height,
        left,
        width: columnWidth - 8,
      }}
      onPointerDown={(e) => begin('move', e)}
      onPointerMove={move}
      onPointerUp={end}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      {dragging && (
        <div className="time-bubble">
          {formatTime(live.startMin)}
        </div>
      )}

      {event.locked
        ? <Lock className="event-icon" size={14}/>
        : <Move className="event-icon" size={15}/>
      }

      <div className="event-title">{live.title}</div>

      {(live.segmentCount ?? 1) > 1 && (
        <span
          className="segment-badge"
          title="Segment d’une tâche fractionnée"
        >
          {(live.segmentIndex ?? 0) + 1}/{live.segmentCount}
        </span>
      )}

      {live.kind === 'flexible' && (
        <span className="flex-dot" title="Tâche flexible"/>
      )}

      {!event.locked && (
        <button
          className="resize-handle"
          onPointerDown={(e) => begin('resize', e)}
          onPointerMove={move}
          onPointerUp={end}
          aria-label="Redimensionner"
        >
          <GripHorizontal size={17}/>
        </button>
      )}
    </article>
  )
}
