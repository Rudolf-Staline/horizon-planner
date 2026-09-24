import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { DAYS, END_MIN, PX_PER_MIN, START_MIN } from '../domain/constants'
import type { PlannerEvent } from '../domain/types'
import { clamp, snapMinutes } from '../utils/time'
import { EventCard } from './EventCard'

interface Props {
  events: PlannerEvent[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onChange: (id: string, patch: Partial<PlannerEvent>) => void
  onEmptyClick: (day: number, startMin: number) => void
}

const COLUMN_WIDTH = 154

export function WeekCalendar({ events, selectedId, onSelect, onChange, onEmptyClick }: Props) {
  const hours = Array.from({ length: 16 }, (_, i) => 7 + i)
  const height = (END_MIN - START_MIN) * PX_PER_MIN

  return (
    <main className="calendar-shell">
      <section className="calendar-toolbar">
        <div className="date-control"><button className="icon-button"><ChevronLeft size={19}/></button><button className="icon-button"><ChevronRight size={19}/></button><h1>20 – 26 mai 2024</h1></div>
        <div className="view-switch"><button>Aujourd’hui</button><button>Jour</button><button className="selected">Semaine</button><button>Mois</button><button>Année</button></div>
      </section>
      <section className="week-grid-wrap">
        <div className="day-head-spacer" />
        <div className="day-heads">{DAYS.map((day, index) => <div className={`day-head ${index === 2 ? 'today' : ''}`} key={day}><span>{day.split(' ')[0]}</span><strong>{day.split(' ')[1]}</strong></div>)}</div>
        <div className="timeline" style={{ height }}>
          {hours.map((h) => <div className="hour-label" key={h} style={{ top: (h * 60 - START_MIN) * PX_PER_MIN }}>{String(h).padStart(2,'0')}:00</div>)}
        </div>
        <div className="week-columns" style={{ height, width: COLUMN_WIDTH * 7 }} onClick={() => onSelect(null)}>
          {DAYS.map((day, dayIndex) => (
            <div
              key={day}
              className="day-column"
              style={{ left: dayIndex * COLUMN_WIDTH, width: COLUMN_WIDTH }}
              onDoubleClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const y = e.clientY - rect.top
                const startMin = clamp(snapMinutes(START_MIN + y / PX_PER_MIN), START_MIN, END_MIN - 30)
                onEmptyClick(dayIndex, startMin)
              }}
            >
              {hours.map((h) => <div key={h} className="hour-line" style={{ top: (h * 60 - START_MIN) * PX_PER_MIN }} />)}
            </div>
          ))}
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              columnWidth={COLUMN_WIDTH}
              selected={selectedId === event.id}
              onSelect={() => onSelect(event.id)}
              onChange={(patch) => onChange(event.id, patch)}
            />
          ))}
          <button className="floating-add" onClick={(e) => { e.stopPropagation(); onEmptyClick(2, 13 * 60) }}><Plus size={22}/></button>
        </div>
      </section>
      <div className="legend">
        <span><i className="dot course"/>Cours</span><span><i className="dot project"/>Projet</span><span><i className="dot personal"/>Personnel</span><span><i className="dot focus"/>Focus</span><span><i className="dot routine"/>Routine</span><span><i className="dot admin"/>Administratif</span><span><i className="dot flexible"/>Flexible</span><span><i className="dot neutral"/>Autre</span>
      </div>
      <p className="hint">Double-clique un créneau pour créer. Glisse une carte pour la déplacer. Tire sa poignée basse pour changer la durée.</p>
    </main>
  )
}
