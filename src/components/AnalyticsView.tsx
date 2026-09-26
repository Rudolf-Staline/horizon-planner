import {
  useMemo,
} from 'react'
import {
  BarChart3,
  Clock3,
  Flame,
  Layers3,
} from 'lucide-react'
import type {
  PlannerEvent,
} from '../domain/types'
import {
  buildWeeklyAnalytics,
} from '../domain/weeklyAnalytics'

export function AnalyticsView({
  events,
  weekStartsOn = 1,
}: {
  events: PlannerEvent[]
  weekStartsOn?: number
}) {
  const metrics =
    useMemo(
      () =>
        buildWeeklyAnalytics(
          events,
          new Date(),
          weekStartsOn,
        ),
      [events, weekStartsOn],
    )

  const hours = (
    minutes: number,
  ) =>
    (
      minutes / 60
    ).toLocaleString(
      'fr-FR',
      {
        maximumFractionDigits: 1,
      },
    )

  return (
    <main className="analytics-page">
      <header className="section-header">
        <div>
          <span className="section-kicker">
            SEMAINE EN COURS
          </span>
          <h1>Analyses</h1>
          <p>
            Une lecture du planning réel de cette semaine, sans score de productivité artificiel.
          </p>
        </div>
      </header>

      <section className="metric-grid">
        <article>
          <Clock3 size={18}/>
          <span>
            Temps planifié
          </span>
          <strong>
            {hours(
              metrics.totalMinutes,
            )}{' '}h
          </strong>
        </article>
        <article>
          <Clock3 size={18}/>
          <span>Temps réalisé</span>
          <strong>{hours(metrics.completedMinutes)} h</strong>
        </article>
        <article>
          <BarChart3 size={18}/>
          <span>Réalisation du plan</span>
          <strong>{metrics.completionRate} %</strong>
        </article>
        <article>
          <Layers3 size={18}/>
          <span>
            Éléments ouverts
          </span>
          <strong>
            {metrics.activeCount}
          </strong>
        </article>
        <article>
          <Flame size={18}/>
          <span>
            Temps de focus
          </span>
          <strong>
            {hours(
              metrics.focusMinutes,
            )}{' '}h
          </strong>
        </article>
        <article>
          <BarChart3 size={18}/>
          <span>Routines</span>
          <strong>
            {hours(
              metrics.routineMinutes,
            )}{' '}h
          </strong>
        </article>
      </section>

      <section className="load-card">
        <div className="load-head">
          <div>
            <span>
              Charge hebdomadaire
            </span>
            <strong>
              {metrics.busiest
                ? `${metrics.busiest.label} est le jour le plus chargé`
                : 'Aucune charge planifiée cette semaine'}
            </strong>
          </div>
          <span>
            {metrics.busiest
              ? `${hours(metrics.busiest.minutes)} h`
              : '0 h'}
          </span>
        </div>

        <div className="load-bars">
          {metrics.byDay.map(
            (item) => (
              <div
                className="load-column"
                key={item.date}
              >
                <div className="load-track">
                  <div
                    className="load-fill"
                    style={{
                      height:
                        `${item.minutes > 0
                          ? Math.max(
                              4,
                              (
                                item.minutes /
                                metrics.max
                              ) *
                                100,
                            )
                          : 0}%`,
                    }}
                  />
                </div>
                <span>
                  {item.shortLabel}
                </span>
              </div>
            ),
          )}
        </div>
      </section>
    </main>
  )
}
