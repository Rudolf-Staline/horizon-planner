import { useMemo, useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { DAYS, END_MIN, START_MIN } from '../domain/constants'
import { planFlexibleTask } from '../domain/scheduling'
import type {
  Category,
  EnergyLevel,
  PlannerEvent,
  Priority,
} from '../domain/types'
import { formatTime, parseTime } from '../utils/time'

interface Props {
  day: number
  startMin: number
  events: PlannerEvent[]
  onClose: () => void
  onCreate: (events: PlannerEvent[]) => void
}

export function QuickCreate({
  day,
  startMin,
  events,
  onClose,
  onCreate,
}: Props) {
  const [title, setTitle] = useState('')
  const [duration, setDuration] = useState(60)
  const [category, setCategory] = useState<Category>('course')
  const [kind, setKind] = useState<'fixed' | 'flexible'>('flexible')
  const [priority, setPriority] = useState<Priority>('medium')
  const [energy, setEnergy] = useState<EnergyLevel>('medium')
  const [deadlineDay, setDeadlineDay] = useState(Math.min(6, day + 2))
  const [windowStart, setWindowStart] = useState(formatTime(Math.max(START_MIN, startMin - 60)))
  const [windowEnd, setWindowEnd] = useState(formatTime(Math.min(END_MIN, startMin + 180)))
  const [splittable, setSplittable] = useState(false)
  const [minChunkMin, setMinChunkMin] = useState(45)
  const [advanced, setAdvanced] = useState(false)
  const [planningError, setPlanningError] = useState<string | null>(null)

  const canCreate = useMemo(
    () => title.trim().length > 1,
    [title],
  )

  const makeDraft = (): PlannerEvent => ({
    id: crypto.randomUUID(),
    title: title.trim(),
    day,
    startMin,
    durationMin: duration,
    category,
    priority,
    kind,
    deadlineDay: kind === 'flexible' ? deadlineDay : undefined,
    windowStartMin: kind === 'flexible'
      ? parseTime(windowStart, START_MIN)
      : undefined,
    windowEndMin: kind === 'flexible'
      ? parseTime(windowEnd, END_MIN)
      : undefined,
    energy: kind === 'flexible' ? energy : undefined,
    splittable: kind === 'flexible' ? splittable : undefined,
    minChunkMin: kind === 'flexible' && splittable
      ? minChunkMin
      : undefined,
  })

  const createHere = () => {
    if (!canCreate) return
    setPlanningError(null)
    onCreate([makeDraft()])
  }

  const smartCreate = () => {
    if (!canCreate) return

    const draft = makeDraft()
    if (draft.kind !== 'flexible') {
      onCreate([draft])
      return
    }

    const plan = planFlexibleTask(draft, events)
    if (!plan) {
      setPlanningError(
        'Aucun créneau admissible. Élargis la fenêtre, repousse la deadline ou autorise le fractionnement.'
      )
      return
    }

    if (plan.kind === 'single') {
      const placement = plan.placements[0]
      onCreate([{
        ...draft,
        day: placement.day,
        startMin: placement.startMin,
        durationMin: placement.durationMin,
      }])
      return
    }

    const created = plan.placements.map((placement, index) => ({
      ...draft,
      id: crypto.randomUUID(),
      title: `${draft.title} · ${index + 1}/${plan.placements.length}`,
      day: placement.day,
      startMin: placement.startMin,
      durationMin: placement.durationMin,
    }))

    onCreate(created)
  }

  return (
    <div className="quick-overlay" onMouseDown={onClose}>
      <section className="quick-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <div>
            <h2>Nouvelle tâche</h2>
            <p>Créer d’abord. Affiner seulement si nécessaire.</p>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={19}/>
          </button>
        </div>

        <input
          autoFocus
          className="field"
          placeholder="Nom de la tâche"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) createHere()
          }}
        />

        <div className="field-grid">
          <label>
            <span>Durée</span>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>1 h</option>
              <option value={90}>1 h 30</option>
              <option value={120}>2 h</option>
              <option value={180}>3 h</option>
            </select>
          </label>

          <label>
            <span>Type</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as 'fixed' | 'flexible')}
            >
              <option value="flexible">Flexible</option>
              <option value="fixed">Fixe</option>
            </select>
          </label>

          <label>
            <span>Catégorie</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              <option value="course">Cours</option>
              <option value="project">Projet</option>
              <option value="focus">Focus</option>
              <option value="routine">Routine</option>
              <option value="personal">Personnel</option>
              <option value="admin">Administratif</option>
            </select>
          </label>

          <label>
            <span>Priorité</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              <option value="low">Basse</option>
              <option value="medium">Moyenne</option>
              <option value="high">Haute</option>
            </select>
          </label>
        </div>

        {kind === 'flexible' && (
          <>
            <button
              className="advanced-link"
              onClick={() => setAdvanced((value) => !value)}
            >
              Options avancées {advanced ? '↑' : '↓'}
            </button>

            {advanced && (
              <div className="advanced-options">
                <label>
                  <span>Deadline</span>
                  <select
                    value={deadlineDay}
                    onChange={(e) => setDeadlineDay(Number(e.target.value))}
                  >
                    {DAYS.slice(day).map((label, index) => (
                      <option key={label} value={day + index}>{label}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Énergie</span>
                  <select
                    value={energy}
                    onChange={(e) => setEnergy(e.target.value as EnergyLevel)}
                  >
                    <option value="low">Faible</option>
                    <option value="medium">Moyenne</option>
                    <option value="high">Élevée</option>
                  </select>
                </label>

                <label>
                  <span>Au plus tôt</span>
                  <input
                    type="time"
                    step={900}
                    value={windowStart}
                    onChange={(e) => setWindowStart(e.target.value)}
                  />
                </label>

                <label>
                  <span>Au plus tard</span>
                  <input
                    type="time"
                    step={900}
                    value={windowEnd}
                    onChange={(e) => setWindowEnd(e.target.value)}
                  />
                </label>

                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={splittable}
                    onChange={(e) => setSplittable(e.target.checked)}
                  />
                  <span>Fractionnable</span>
                </label>

                {splittable && (
                  <label>
                    <span>Bloc minimum</span>
                    <select
                      value={minChunkMin}
                      onChange={(e) => setMinChunkMin(Number(e.target.value))}
                    >
                      <option value={30}>30 min</option>
                      <option value={45}>45 min</option>
                      <option value={60}>1 h</option>
                    </select>
                  </label>
                )}
              </div>
            )}
          </>
        )}

        {planningError && (
          <p className="planning-error">{planningError}</p>
        )}

        <div className="panel-actions">
          <button className="btn secondary" onClick={onClose}>
            Annuler
          </button>

          {kind === 'flexible' && (
            <button
              className="btn secondary"
              disabled={!canCreate}
              onClick={createHere}
            >
              Créer ici
            </button>
          )}

          <button
            className="btn primary smart-button"
            disabled={!canCreate}
            onClick={kind === 'flexible' ? smartCreate : createHere}
          >
            {kind === 'flexible' && <Sparkles size={16}/>}
            {kind === 'flexible' ? 'Planifier' : 'Créer'}
          </button>
        </div>
      </section>
    </div>
  )
}
