import { useMemo } from 'react'
import { BarChart3, Clock3, Flame, Layers3 } from 'lucide-react'
import { DAYS } from '../domain/constants'
import type { PlannerEvent } from '../domain/types'

export function AnalyticsView({ events }: { events: PlannerEvent[] }) {
  const metrics = useMemo(() => {
    const active = events.filter((event) => !event.completed)
    const totalMinutes = active.reduce(
      (sum, event) => sum + event.durationMin,
      0,
    )
    const focusMinutes = active
      .filter((event) => event.category === 'focus')
      .reduce((sum, event) => sum + event.durationMin, 0)
    const routineMinutes = active
      .filter((event) => event.category === 'routine')
      .reduce((sum, event) => sum + event.durationMin, 0)

    const byDay = DAYS.map((label, day) => ({
      label,
      minutes: active
        .filter((event) => event.day === day)
        .reduce((sum, event) => sum + event.durationMin, 0),
    }))

    const max = Math.max(...byDay.map((item) => item.minutes), 1)
    const busiest = byDay.reduce((best, current) =>
      current.minutes > best.minutes ? current : best
    )

    return {
      activeCount: active.length,
      totalMinutes,
      focusMinutes,
      routineMinutes,
      byDay,
      max,
      busiest,
    }
  }, [events])

  const hours = (minutes: number) =>
    (minutes / 60).toLocaleString('fr-FR', {
      maximumFractionDigits: 1,
    })

  return (
    <main className="analytics-page">
      <header className="section-header">
        <div>
          <span className="section-kicker">SEMAINE</span>
          <h1>Analyses</h1>
          <p>Une lecture du planning réel, sans score de productivité artificiel.</p>
        </div>
      </header>

      <section className="metric-grid">
        <article>
          <Clock3 size={18}/>
          <span>Temps planifié</span>
          <strong>{hours(metrics.totalMinutes)} h</strong>
        </article>
        <article>
          <Layers3 size={18}/>
          <span>Éléments ouverts</span>
          <strong>{metrics.activeCount}</strong>
        </article>
        <article>
          <Flame size={18}/>
          <span>Temps de focus</span>
          <strong>{hours(metrics.focusMinutes)} h</strong>
        </article>
        <article>
          <BarChart3 size={18}/>
          <span>Routines</span>
          <strong>{hours(metrics.routineMinutes)} h</strong>
        </article>
      </section>

      <section className="load-card">
        <div className="load-head">
          <div>
            <span>Charge hebdomadaire</span>
            <strong>{metrics.busiest.label} est le jour le plus chargé</strong>
          </div>
          <span>{hours(metrics.busiest.minutes)} h</span>
        </div>

        <div className="load-bars">
          {metrics.byDay.map((item) => (
            <div className="load-column" key={item.label}>
              <div className="load-track">
                <div
                  className="load-fill"
                  style={{
                    height: `${Math.max(
                      4,
                      (item.minutes / metrics.max) * 100,
                    )}%`,
                  }}
                />
              </div>
              <span>{item.label.split(' ')[0]}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
