import { Pause, Play, Square } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { PlannerEvent } from '../domain/types'
import {
  formatLongDate,
  toISODate,
} from '../utils/date'
import { formatTime } from '../utils/time'

interface Props {
  events: PlannerEvent[]
  onComplete: (id: string) => void
}

export function NowView({
  events,
  onComplete,
}: Props) {
  const [now, setNow] = useState(() => new Date())
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(new Date()),
      30_000,
    )
    return () => window.clearInterval(timer)
  }, [])

  const today = toISODate(now)
  const currentMin =
    now.getHours() * 60 + now.getMinutes()

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

  const current = todayEvents.find(
    (event) =>
      event.startMin <= currentMin &&
      event.startMin + event.durationMin >
        currentMin,
  )

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
    .slice(0, 3)

  const remaining =
    current
      ? Math.max(
          0,
          current.startMin +
            current.durationMin -
            currentMin,
        )
      : next
        ? Math.max(
            0,
            next.startMin - currentMin,
          )
        : 0

  return (
    <main className="now-page">
      <div className="now-time">
        {new Intl.DateTimeFormat('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        }).format(now)}
      </div>
      <div className="now-date">
        {formatLongDate(now)}
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
          <div className="remaining">
            {remaining} min {current
              ? 'restantes'
              : 'avant le début'}
          </div>

          <div className="focus-actions">
            {current && (
              <button
                onClick={() =>
                  setPaused((value) => !value)}
              >
                {paused
                  ? <Play size={17}/>
                  : <Pause size={17}/>}
                {paused ? 'Reprendre' : 'Pause'}
              </button>
            )}

            <button
              onClick={() =>
                onComplete(next.id)}
            >
              <Square size={16}/>
              Terminer
            </button>
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
              <span>{event.title}</span>
            </div>
          ))
        )}
      </section>
    </main>
  )
}
