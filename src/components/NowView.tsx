import { Pause, Play, Square } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { PlannerEvent } from '../domain/types'
import {
  logicalTaskId,
  taskProgress,
} from '../domain/taskIdentity'
import {
  focusSessionRemaining,
  pauseFocusSession,
  resumeFocusSession,
  startFocusSession,
  type FocusSession,
} from '../domain/focusSession'
import { formatTime } from '../utils/time'
import {
  zonedDateMinutes,
  zonedDateToIso,
} from '../utils/timezone'
import { isReadOnlyCalendarEvent } from '../domain/taskIdentity'

interface Props {
  events: PlannerEvent[]
  onCompleteSegment: (id: string) => void
  onCompleteTask: (id: string) => void
  timeZone: string
}

export function NowView({
  events,
  onCompleteSegment,
  onCompleteTask,
  timeZone,
}: Props) {
  const [now, setNow] = useState(() => new Date())
  const [session, setSession] =
    useState<FocusSession | null>(null)

  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(new Date()),
      1_000,
    )
    return () => window.clearInterval(timer)
  }, [])

  const today = zonedDateToIso(now, timeZone)
  const currentMin = zonedDateMinutes(now, timeZone)

  const todayEvents = useMemo(
    () =>
      events
        .filter(
          (event) =>
            event.date === today &&
            !event.completed,
        )
        .sort(
          (a, b) =>
            a.startMin - b.startMin,
        ),
    [events, today],
  )

  const scheduledCurrent =
    todayEvents.find(
      (event) =>
        event.startMin <=
          currentMin &&
        event.startMin +
          event.durationMin >
          currentMin,
    )

  const sessionEvent =
    session
      ? events.find(
          (event) =>
            event.id ===
              session.eventId &&
            !event.completed,
        ) ?? null
      : null

  useEffect(() => {
    if (
      session &&
      !sessionEvent
    ) {
      setSession(null)
      return
    }

    if (
      !session &&
      scheduledCurrent &&
      !scheduledCurrent.virtual &&
      !isReadOnlyCalendarEvent(scheduledCurrent)
    ) {
      const nowSeconds =
        currentMin * 60 +
        now.getSeconds()
      const endSeconds =
        (
          scheduledCurrent.startMin +
          scheduledCurrent.durationMin
        ) * 60

      setSession(
        startFocusSession(
          scheduledCurrent.id,
          endSeconds -
            nowSeconds,
          now.getTime(),
        ),
      )
    }
  }, [
    session,
    sessionEvent,
    scheduledCurrent,
    now,
    currentMin,
  ])

  const current =
    sessionEvent ??
    scheduledCurrent

  const next =
    current ??
    todayEvents.find(
      (event) =>
        event.startMin > currentMin,
    )

  const upcoming = todayEvents
    .filter(
      (event) =>
        event.id !== next?.id &&
        event.startMin >
          (next?.startMin ?? currentMin),
    )
    .slice(0, 2)

  const remaining =
    current &&
    session &&
    session.eventId ===
      current.id
      ? Math.ceil(
          focusSessionRemaining(
            session,
            now.getTime(),
          ) / 60,
        )
      : current
        ? Math.max(
            0,
            current.startMin +
              current.durationMin -
              currentMin,
          )
        : next
          ? Math.max(
              0,
              next.startMin -
                currentMin,
            )
          : 0

  const taskSegments = useMemo(() => {
    if (
      !next ||
      next.entityType !== 'task'
    ) {
      return []
    }

    const taskId =
      logicalTaskId(next)

    return events
      .filter(
        (event) =>
          event.entityType === 'task' &&
          logicalTaskId(event) === taskId,
      )
      .sort(
        (a, b) =>
          (a.segmentIndex ?? 0) -
            (b.segmentIndex ?? 0) ||
          (a.date ?? '').localeCompare(
            b.date ?? '',
          ) ||
          a.startMin - b.startMin,
      )
  }, [events, next])

  const progress =
    taskProgress(taskSegments)
  const multiSegment =
    taskSegments.length > 1
  const segmentPosition =
    multiSegment && next
      ? (
          taskSegments.findIndex(
            (segment) =>
              segment.id === next.id,
          ) + 1
        )
      : 0

  return (
    <main className="now-page">
      <div className="now-time">
        {new Intl.DateTimeFormat('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone,
        }).format(now)}
      </div>
      <div className="now-date">
        {new Intl.DateTimeFormat('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone,
        }).format(now)}
      </div>

      {next ? (
        <section
          className={
            `current-focus category-${next.category}`
          }
        >
          <span className="eyebrow">
            {current
              ? 'EN COURS'
              : 'PROCHAINE TÂCHE'}
          </span>
          <h1>{next.title}</h1>
          <p>
            {current
              ? 'Une seule chose à la fois.'
              : `Prévue à ${formatTime(next.startMin)}.`}
          </p>

          {multiSegment && (
            <div className="now-task-progress">
              <div>
                <span>
                  Bloc {segmentPosition}/{progress.totalSegments}
                </span>
                <strong>
                  {progress.percent}%
                </strong>
              </div>
              <div className="now-task-progress-track">
                <i
                  style={{
                    width:
                      progress.percent +
                      '%',
                  }}
                />
              </div>
              <small>
                {progress.completedSegments}/
                {progress.totalSegments}
                {' '}blocs terminés ·{' '}
                {progress.completedDuration}/
                {progress.totalDuration}
                {' '}min
              </small>
            </div>
          )}

          <div className="remaining">
            {remaining} min {current
              ? session?.paused &&
                session.eventId ===
                  current.id
                ? 'figées pendant la pause'
                : 'restantes'
              : 'avant le début'}
          </div>

          <div className="focus-actions">
            {current &&
              session &&
              session.eventId ===
                current.id && (
              <button
                onClick={() =>
                  setSession(
                    (value) => {
                      if (!value) {
                        return value
                      }

                      return value.paused
                        ? resumeFocusSession(
                            value,
                            Date.now(),
                          )
                        : pauseFocusSession(
                            value,
                            Date.now(),
                          )
                    },
                  )
                }
              >
                {session.paused
                  ? <Play size={17}/>
                  : <Pause size={17}/>}
                {session.paused
                  ? 'Reprendre'
                  : 'Pause'}
              </button>
            )}

            {!next.virtual &&
              !isReadOnlyCalendarEvent(next) && (
              <button
                onClick={() =>
                  onCompleteSegment(
                    next.id,
                  )}
              >
                <Square size={16}/>
                {multiSegment
                  ? 'Terminer ce bloc'
                  : 'Terminer'}
              </button>
            )}

            {!next.virtual &&
              !isReadOnlyCalendarEvent(next) &&
              multiSegment && (
              <button
                className="complete-task"
                onClick={() =>
                  onCompleteTask(
                    next.id,
                  )}
              >
                <Square size={16}/>
                Terminer la tâche
              </button>
            )}
          </div>
        </section>
      ) : (
        <section className="now-empty">
          <strong>Rien de planifié maintenant.</strong>
          <span>
            Votre journée est libre pour le moment.
          </span>
        </section>
      )}

      <section className="upcoming">
        <h2>Ensuite</h2>
        {upcoming.length === 0 ? (
          <p className="now-empty-copy">
            Aucun autre élément aujourd’hui.
          </p>
        ) : (
          upcoming.map((event) => (
            <div
              className="upcoming-row"
              key={event.id}
            >
              <time>
                {formatTime(event.startMin)}
              </time>
              <span>
                {event.title}
                {(event.segmentCount ?? 1) >
                  1 &&
                  ` · bloc ${(event.segmentIndex ?? 0) + 1}/${event.segmentCount}`}
              </span>
            </div>
          ))
        )}
      </section>
    </main>
  )
}
