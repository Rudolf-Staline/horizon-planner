import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import {
  END_MIN,
  PX_PER_MIN,
  START_MIN,
} from '../domain/constants'
import type { PlannerEvent } from '../domain/types'
import {
  addDays,
  addMonths,
  addYears,
  eventDateLabel,
  formatDayHeading,
  formatLongDate,
  formatMonth,
  formatWeekRange,
  formatYear,
  fromISODate,
  monthGridDates,
  sameDate,
  startOfWeek,
  toISODate,
  weekDates,
  weekdayIndex,
} from '../utils/date'
import { clamp, snapMinutes } from '../utils/time'
import { EventCard } from './EventCard'

export type CalendarMode = 'day' | 'week' | 'month' | 'year'

interface Props {
  mode: CalendarMode
  anchorDate: string
  events: PlannerEvent[]
  selectedId: string | null
  onMode: (mode: CalendarMode) => void
  onAnchorDate: (date: string) => void
  onSelect: (id: string | null) => void
  onChange: (
    id: string,
    patch: Partial<PlannerEvent>,
  ) => void
  onEmptyClick: (
    date: string,
    day: number,
    startMin: number,
  ) => void
}

const HOUR_COUNT = 16

function eventsOnDate(
  events: PlannerEvent[],
  date: Date,
) {
  const iso = toISODate(date)
  return events
    .filter((event) => event.date === iso)
    .sort((a, b) => a.startMin - b.startMin)
}

export function CalendarView({
  mode,
  anchorDate,
  events,
  selectedId,
  onMode,
  onAnchorDate,
  onSelect,
  onChange,
  onEmptyClick,
}: Props) {
  const anchor = fromISODate(anchorDate)
  const today = new Date()
  const hours = Array.from(
    { length: HOUR_COUNT },
    (_, index) => 7 + index,
  )
  const height = (END_MIN - START_MIN) * PX_PER_MIN

  const navigate = (direction: -1 | 1) => {
    const next =
      mode === 'day'
        ? addDays(anchor, direction)
        : mode === 'week'
          ? addDays(anchor, direction * 7)
          : mode === 'month'
            ? addMonths(anchor, direction)
            : addYears(anchor, direction)

    onAnchorDate(toISODate(next))
  }

  const title =
    mode === 'day'
      ? formatLongDate(anchor)
      : mode === 'week'
        ? formatWeekRange(anchor)
        : mode === 'month'
          ? formatMonth(anchor)
          : formatYear(anchor)

  const renderTimeGrid = () => {
    const dates =
      mode === 'day'
        ? [anchor]
        : weekDates(anchor)

    const columnWidth =
      mode === 'day' ? 760 : 154
    const gridWidth = columnWidth * dates.length

    const visibleEvents = dates.flatMap(
      (date, visibleDay) =>
        eventsOnDate(events, date).map((event) => ({
          ...event,
          day: visibleDay,
        })),
    )

    return (
      <>
        <section
          className={`week-grid-wrap ${mode === 'day' ? 'day-grid-wrap' : ''}`}
        >
          <div className="day-head-spacer"/>
          <div
            className="day-heads"
            style={{
              gridTemplateColumns:
                `repeat(${dates.length}, ${columnWidth}px)`,
            }}
          >
            {dates.map((date) => {
              const heading = formatDayHeading(date)
              return (
                <div
                  className={
                    `day-head ${sameDate(date, today) ? 'today' : ''}`
                  }
                  key={toISODate(date)}
                >
                  <span>{heading.weekday}</span>
                  <strong>{heading.day}</strong>
                </div>
              )
            })}
          </div>

          <div className="timeline" style={{ height }}>
            {hours.map((hour) => (
              <div
                className="hour-label"
                key={hour}
                style={{
                  top:
                    (hour * 60 - START_MIN) *
                    PX_PER_MIN,
                }}
              >
                {String(hour).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          <div
            className="week-columns"
            style={{ height, width: gridWidth }}
            onClick={() => onSelect(null)}
          >
            {dates.map((date, visibleDay) => (
              <div
                key={toISODate(date)}
                className="day-column"
                style={{
                  left: visibleDay * columnWidth,
                  width: columnWidth,
                }}
                onDoubleClick={(event) => {
                  const rect =
                    event.currentTarget.getBoundingClientRect()
                  const y =
                    event.clientY - rect.top
                  const startMin = clamp(
                    snapMinutes(
                      START_MIN + y / PX_PER_MIN,
                    ),
                    START_MIN,
                    END_MIN - 30,
                  )
                  onEmptyClick(
                    toISODate(date),
                    weekdayIndex(date),
                    startMin,
                  )
                }}
              >
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="hour-line"
                    style={{
                      top:
                        (hour * 60 - START_MIN) *
                        PX_PER_MIN,
                    }}
                  />
                ))}
              </div>
            ))}

            {visibleEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                columnWidth={columnWidth}
                maxDay={dates.length - 1}
                selected={selectedId === event.id}
                onSelect={() => onSelect(event.id)}
                onChange={(patch) => {
                  const visibleDay =
                    patch.day ?? event.day
                  const targetDate =
                    dates[
                      Math.min(
                        dates.length - 1,
                        Math.max(0, visibleDay),
                      )
                    ]

                  onChange(event.id, {
                    ...patch,
                    date: toISODate(targetDate),
                    day: weekdayIndex(targetDate),
                  })
                }}
              />
            ))}

            <button
              className="floating-add"
              onClick={(event) => {
                event.stopPropagation()
                const date =
                  mode === 'day'
                    ? anchor
                    : dates.find((value) =>
                        sameDate(value, today)
                      ) ?? dates[0]

                onEmptyClick(
                  toISODate(date),
                  weekdayIndex(date),
                  13 * 60,
                )
              }}
            >
              <Plus size={22}/>
            </button>
          </div>
        </section>

        <div className="legend">
          <span><i className="dot course"/>Cours</span>
          <span><i className="dot project"/>Projet</span>
          <span><i className="dot personal"/>Personnel</span>
          <span><i className="dot focus"/>Focus</span>
          <span><i className="dot routine"/>Routine</span>
          <span><i className="dot admin"/>Administratif</span>
          <span><i className="dot flexible"/>Flexible</span>
          <span><i className="dot neutral"/>Autre</span>
        </div>
        <p className="hint">
          Double-clique un créneau pour créer. Glisse une carte pour la
          déplacer. Tire sa poignée basse pour changer la durée.
        </p>
      </>
    )
  }

  const renderMonth = () => {
    const dates = monthGridDates(anchor)
    const month = anchor.getMonth()

    return (
      <section className="month-view">
        <div className="month-weekdays">
          {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(
            (label) => <span key={label}>{label}</span>,
          )}
        </div>

        <div className="month-grid">
          {dates.map((date) => {
            const dayEvents = eventsOnDate(events, date)
            const iso = toISODate(date)
            const outside =
              date.getMonth() !== month

            return (
              <button
                key={iso}
                className={[
                  'month-day',
                  outside ? 'outside' : '',
                  sameDate(date, today) ? 'today' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => {
                  onAnchorDate(iso)
                  onMode('day')
                }}
                onDoubleClick={() =>
                  onEmptyClick(
                    iso,
                    weekdayIndex(date),
                    9 * 60,
                  )
                }
              >
                <strong>{date.getDate()}</strong>
                <div className="month-events">
                  {dayEvents.slice(0, 3).map((event) => (
                    <span
                      key={event.id}
                      className={`month-event category-${event.category}`}
                    >
                      {event.title}
                    </span>
                  ))}
                  {dayEvents.length > 3 && (
                    <small>
                      +{dayEvents.length - 3}
                    </small>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </section>
    )
  }

  const renderYear = () => (
    <section className="year-view">
      {Array.from({ length: 12 }, (_, month) => {
        const monthDate = new Date(
          anchor.getFullYear(),
          month,
          1,
          12,
        )
        const prefix =
          `${anchor.getFullYear()}-${String(month + 1).padStart(2, '0')}-`
        const count = events.filter(
          (event) =>
            event.date?.startsWith(prefix),
        ).length

        return (
          <button
            key={month}
            className="year-month"
            onClick={() => {
              onAnchorDate(toISODate(monthDate))
              onMode('month')
            }}
          >
            <span>
              {new Intl.DateTimeFormat('fr-FR', {
                month: 'long',
              }).format(monthDate)}
            </span>
            <strong>{count}</strong>
            <small>
              {count > 1 ? 'éléments' : 'élément'}
            </small>
          </button>
        )
      })}
    </section>
  )

  return (
    <main className="calendar-shell">
      <section className="calendar-toolbar">
        <div className="date-control">
          <button
            className="icon-button"
            aria-label="Période précédente"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft size={19}/>
          </button>
          <button
            className="icon-button"
            aria-label="Période suivante"
            onClick={() => navigate(1)}
          >
            <ChevronRight size={19}/>
          </button>
          <h1>{title}</h1>
        </div>

        <div className="view-switch">
          <button
            onClick={() =>
              onAnchorDate(toISODate(new Date()))
            }
          >
            Aujourd’hui
          </button>
          {([
            ['day', 'Jour'],
            ['week', 'Semaine'],
            ['month', 'Mois'],
            ['year', 'Année'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              className={mode === value ? 'selected' : ''}
              onClick={() => onMode(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {(mode === 'day' || mode === 'week') &&
        renderTimeGrid()}
      {mode === 'month' && renderMonth()}
      {mode === 'year' && renderYear()}
    </main>
  )
}
