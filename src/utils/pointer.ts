import {
  END_MIN,
  PX_PER_MIN,
  SNAP_MINUTES,
  START_MIN,
} from '../domain/constants'
import {
  clamp,
  snapMinutes,
} from './time'

export type CalendarGestureMode =
  | 'move'
  | 'resize'

export interface CalendarGestureOrigin {
  mode: CalendarGestureMode
  startX: number
  startY: number
  originalDay: number
  originalStart: number
  originalDuration: number
  originalScrollTop: number
  originalScrollLeft: number
}

interface CalendarGesturePoint {
  clientX: number
  clientY: number
  scrollTop: number
  scrollLeft: number
}

export function calendarGesturePatch(
  origin: CalendarGestureOrigin,
  point: CalendarGesturePoint,
  columnWidth: number,
  maxDay: number,
) {
  const scrollDy =
    point.scrollTop -
    origin.originalScrollTop
  const scrollDx =
    point.scrollLeft -
    origin.originalScrollLeft

  const dy =
    point.clientY -
    origin.startY +
    scrollDy
  const dx =
    point.clientX -
    origin.startX +
    scrollDx

  const deltaMin =
    snapMinutes(
      dy / PX_PER_MIN,
    )

  if (origin.mode === 'resize') {
    return {
      durationMin: clamp(
        origin.originalDuration +
          deltaMin,
        SNAP_MINUTES,
        END_MIN -
          origin.originalStart,
      ),
    }
  }

  const dayDelta =
    columnWidth > 0
      ? Math.round(
          dx / columnWidth,
        )
      : 0

  return {
    day: clamp(
      origin.originalDay +
        dayDelta,
      0,
      Math.max(0, maxDay),
    ),
    startMin: clamp(
      snapMinutes(
        origin.originalStart +
          deltaMin,
      ),
      START_MIN,
      END_MIN -
        origin.originalDuration,
    ),
  }
}

export function edgeScrollDelta(
  position: number,
  start: number,
  end: number,
  threshold = 72,
  maxStep = 24,
) {
  if (
    !Number.isFinite(position) ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end <= start ||
    threshold <= 0 ||
    maxStep <= 0
  ) {
    return 0
  }

  const safeThreshold = Math.min(
    threshold,
    (end - start) / 2,
  )

  if (
    position <
    start + safeThreshold
  ) {
    const ratio = Math.min(
      1,
      Math.max(
        0,
        (
          start +
          safeThreshold -
          position
        ) / safeThreshold,
      ),
    )

    return -Math.ceil(
      maxStep * ratio,
    )
  }

  if (
    position >
    end - safeThreshold
  ) {
    const ratio = Math.min(
      1,
      Math.max(
        0,
        (
          position -
          (end - safeThreshold)
        ) / safeThreshold,
      ),
    )

    return Math.ceil(
      maxStep * ratio,
    )
  }

  return 0
}
