import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { GripHorizontal, Lock, Move } from 'lucide-react'
import {
  END_MIN,
  PX_PER_MIN,
  SNAP_MINUTES,
  START_MIN,
} from '../domain/constants'
import type { PlannerEvent } from '../domain/types'
import {
  clamp,
  formatTime,
} from '../utils/time'
import {
  calendarGesturePatch,
  edgeScrollDelta,
  type CalendarGestureOrigin,
} from '../utils/pointer'

interface Props {
  event: PlannerEvent
  columnWidth: number
  laneIndex?: number
  laneCount?: number
  maxDay?: number
  selected: boolean
  onSelect: () => void
  onChange: (patch: Partial<PlannerEvent>) => void
}

type Gesture = CalendarGestureOrigin

export function EventCard({
  event,
  columnWidth,
  laneIndex = 0,
  laneCount = 1,
  maxDay = 6,
  selected,
  onSelect,
  onChange,
}: Props) {
  const [preview, setPreview] =
    useState<Partial<PlannerEvent> | null>(null)
  const [dragging, setDragging] = useState(false)
  const gesture = useRef<Gesture | null>(null)
  const gestureMoved = useRef(false)
  const suppressClickUntil = useRef(0)
  const live = { ...event, ...(preview ?? {}) }

  const begin = (
    mode: Gesture['mode'],
    e: PointerEvent,
  ) => {
    e.stopPropagation()

    if (event.locked) return

    ;(e.currentTarget as HTMLElement).setPointerCapture(
      e.pointerId,
    )

    const scrollContainer =
      (e.currentTarget as HTMLElement)
        .closest(
          '.calendar-shell',
        ) as HTMLElement | null

    gestureMoved.current = false
    if (mode === 'resize') {
      suppressClickUntil.current =
        Number.POSITIVE_INFINITY
    }

    gesture.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      originalDay: event.day,
      originalStart: event.startMin,
      originalDuration: event.durationMin,
      originalScrollTop:
        scrollContainer?.scrollTop ?? 0,
      originalScrollLeft:
        scrollContainer?.scrollLeft ?? 0,
    }
  }

  const move = (e: PointerEvent) => {
    const g = gesture.current
    if (!g) return

    const movedDistance =
      Math.hypot(
        e.clientX - g.startX,
        e.clientY - g.startY,
      )

    if (
      !gestureMoved.current &&
      movedDistance < 5
    ) {
      return
    }

    if (!gestureMoved.current) {
      gestureMoved.current = true
      setDragging(true)
    }

    const scrollContainer =
      (e.currentTarget as HTMLElement)
        .closest(
          '.calendar-shell',
        ) as HTMLElement | null

    if (scrollContainer) {
      const rect =
        scrollContainer.getBoundingClientRect()

      const scrollY =
        edgeScrollDelta(
          e.clientY,
          rect.top,
          rect.bottom,
        )
      const scrollX =
        edgeScrollDelta(
          e.clientX,
          rect.left,
          rect.right,
          56,
          18,
        )

      if (scrollY !== 0) {
        scrollContainer.scrollTop +=
          scrollY
      }

      if (scrollX !== 0) {
        scrollContainer.scrollLeft +=
          scrollX
      }
    }

    setPreview(
      calendarGesturePatch(
        g,
        {
          clientX: e.clientX,
          clientY: e.clientY,
          scrollTop:
            scrollContainer?.scrollTop ??
            0,
          scrollLeft:
            scrollContainer?.scrollLeft ??
            0,
        },
        columnWidth,
        maxDay,
      ),
    )
  }

  const keyboard = (
    e: KeyboardEvent<HTMLElement>,
  ) => {
    if (
      e.key === 'Enter' ||
      e.key === ' '
    ) {
      e.preventDefault()
      onSelect()
      return
    }

    if (e.key === 'Escape') {
      setPreview(null)
      gesture.current = null
      setDragging(false)
      return
    }

    if (event.locked) return

    if (
      ![
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
      ].includes(e.key)
    ) {
      return
    }

    e.preventDefault()

    if (
      e.shiftKey &&
      (
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown'
      )
    ) {
      const direction =
        e.key === 'ArrowDown'
          ? 1
          : -1
      onChange({
        durationMin: clamp(
          event.durationMin +
            direction * SNAP_MINUTES,
          SNAP_MINUTES,
          END_MIN - event.startMin,
        ),
      })
      return
    }

    if (
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight'
    ) {
      const direction =
        e.key === 'ArrowRight'
          ? 1
          : -1
      onChange({
        day: clamp(
          event.day + direction,
          0,
          maxDay,
        ),
      })
      return
    }

    const direction =
      e.key === 'ArrowDown'
        ? 1
        : -1
    onChange({
      startMin: clamp(
        event.startMin +
          direction * SNAP_MINUTES,
        START_MIN,
        END_MIN - event.durationMin,
      ),
    })
  }

  const end = (e: PointerEvent) => {
    if (!gesture.current) return

    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(
        e.pointerId,
      )
    } catch {}

    if (preview) onChange(preview)

    if (
      gestureMoved.current ||
      gesture.current.mode === 'resize'
    ) {
      suppressClickUntil.current =
        performance.now() + 300
    }

    gesture.current = null
    gestureMoved.current = false
    setPreview(null)
    setDragging(false)
  }

  const top = (live.startMin - START_MIN) * PX_PER_MIN
  const height = Math.max(live.durationMin * PX_PER_MIN, 34)
  const usableWidth =
    Math.max(24, columnWidth - 8)
  const safeLaneCount =
    Math.max(1, laneCount)
  const safeLaneIndex =
    clamp(
      laneIndex,
      0,
      safeLaneCount - 1,
    )
  const laneWidth =
    usableWidth / safeLaneCount
  const laneGap =
    safeLaneCount > 1 ? 4 : 0
  const left =
    live.day * columnWidth +
    safeLaneIndex * laneWidth
  const width = Math.max(
    20,
    laneWidth - laneGap,
  )

  return (
    <article
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={
        event.title +
        (event.kind === 'flexible'
          ? ', tâche flexible'
          : ', événement fixe') +
        ((event.segmentCount ?? 1) > 1
          ? ', bloc ' +
            ((event.segmentIndex ?? 0) + 1) +
            ' sur ' +
            event.segmentCount
          : '')
      }
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
        width,
      }}
      onPointerDown={(e) => begin('move', e)}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={keyboard}
      onClick={(e) => {
        e.stopPropagation()

        if (
          performance.now() <
          suppressClickUntil.current
        ) {
          return
        }

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
