import { useMemo, useState } from 'react'
import { CalendarDays, X } from 'lucide-react'
import { addDays, fromISODate, toISODate } from '../utils/date'
import { buildRepeatedTasks, repeatedDates } from '../domain/quickCreate'
import type { Category, PlannerEvent } from '../domain/types'

interface Props {
  anchorDate: string
  onClose: () => void
  onCreate: (events: PlannerEvent[]) => void
}

const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const categories: { value: Category; label: string }[] = [
  { value: 'neutral', label: 'Autre' },
  { value: 'course', label: 'Cours' },
  { value: 'project', label: 'Projet' },
  { value: 'focus', label: 'Concentration' },
  { value: 'personal', label: 'Personnel' },
  { value: 'admin', label: 'Administratif' },
]

export function BatchQuickCreate({ anchorDate, onClose, onCreate }: Props) {
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState(anchorDate)
  const [endDate, setEndDate] = useState(anchorDate)
  const [selectedDays, setSelectedDays] = useState([0, 1, 2, 3, 4, 5, 6])
  const [time, setTime] = useState('09:00')
  const [duration, setDuration] = useState(60)
  const [category, setCategory] = useState<Category>('neutral')
  const dates = useMemo(
    () => repeatedDates(startDate, endDate, selectedDays),
    [startDate, endDate, selectedDays],
  )
  const rangeTooLong =
    /^\d{4}-\d{2}-\d{2}$/.test(startDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(endDate) &&
    endDate > toISODate(addDays(fromISODate(startDate), 30))
  const timeValid = /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  const [hour, minute] = time.split(':').map(Number)
  const startMin = hour * 60 + minute
  const valid = title.trim().length > 0 && dates.length > 0 && timeValid &&
    Number.isInteger(duration) && duration >= 15 && duration % 15 === 0 &&
    startMin + duration <= 1440

  const submit = () => {
    if (!valid) return
    onCreate(buildRepeatedTasks(dates, title, startMin, duration, category))
  }

  return (
    <div className="batch-overlay" onMouseDown={onClose}>
      <section className="batch-dialog" role="dialog" aria-modal="true"
        aria-labelledby="batch-title" onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => { if (event.key === 'Escape') onClose() }}>
        <div className="batch-head">
          <div className="batch-icon"><CalendarDays size={20}/></div>
          <div><span>CRÉATION MULTIPLE</span><h2 id="batch-title">Un créneau, plusieurs jours.</h2></div>
          <button type="button" aria-label="Fermer" onClick={onClose}><X size={18}/></button>
        </div>
        <div className="batch-fields">
          <label className="batch-full"><span>Nom de la tâche</span>
            <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex. Réviser les EDP"/></label>
          <label><span>Du</span><input type="date" value={startDate}
            onChange={(event) => {
              const next = event.target.value
              setStartDate(next)
              if (endDate < next) setEndDate(next)
            }}/></label>
          <label><span>Au (inclus)</span><input type="date" min={startDate}
            value={endDate} onChange={(event) => setEndDate(event.target.value)}/></label>
          <fieldset className="batch-full batch-weekdays"><legend>Jours à retenir</legend>
            <div>{days.map((label, day) => (
              <button type="button" key={label} className={selectedDays.includes(day) ? 'active' : ''}
                aria-pressed={selectedDays.includes(day)}
                onClick={() => setSelectedDays((current) => current.includes(day)
                  ? current.filter((item) => item !== day) : [...current, day])}>{label}</button>
            ))}</div>
          </fieldset>
          <label><span>Heure identique</span><input type="time" step={900} value={time}
            onChange={(event) => setTime(event.target.value)}/></label>
          <label><span>Durée (minutes)</span><input type="number" min={15} max={1440}
            step={15} value={duration} onChange={(event) => setDuration(Number(event.target.value))}/></label>
          <label className="batch-full"><span>Catégorie</span><select value={category}
            onChange={(event) => setCategory(event.target.value as Category)}>
            {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select></label>
        </div>
        <div className="batch-preview" role="status">
          <strong>{dates.length} créneau{dates.length > 1 ? 'x' : ''}</strong>
          <span>{rangeTooLong ? 'La période ne peut pas dépasser 31 jours.'
            : dates.length === 0 ? 'Choisis au moins un jour dans la période.'
            : `${dates[0]} → ${dates[dates.length - 1]} · ${time}`}</span>
        </div>
        <div className="batch-actions">
          <button type="button" onClick={onClose}>Annuler</button>
          <button type="button" disabled={!valid} onClick={submit}>
            Créer {dates.length} créneau{dates.length > 1 ? 'x' : ''}
          </button>
        </div>
      </section>
    </div>
  )
}
