import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Copy,
  Layers3,
  Lock,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type {
  Category,
  EnergyLevel,
  EventKind,
  PlannerEvent,
  Priority,
} from '../domain/types'
import {
  END_MIN,
  START_MIN,
} from '../domain/constants'
import { taskProgress } from '../domain/taskIdentity'
import {
  overdueLabel,
  taskOverdueState,
} from '../domain/overdue'
import {
  addDays,
  fromISODate,
  toISODate,
  weekdayIndex,
} from '../utils/date'
import { formatTime, parseTime } from '../utils/time'
import {
  listProjects,
  type Project,
} from '../data/projects'

interface Props {
  event: PlannerEvent
  segments: PlannerEvent[]
  userId: string
  onClose: () => void
  onChange: (
    id: string,
    patch: Partial<PlannerEvent>,
  ) => void
  onDuplicate: (
    id: string,
  ) =>
    | { ok: true; selectedId: string }
    | { ok: false; message: string }
  onDeleteSegment: (id: string) => void
  onDeleteTask: (id: string) => void
  onToggleSegment: (id: string) => void
  onToggleTask: (id: string) => void
  todayDate: string
  onReplan: (
    id: string,
    newDeadlineDate: string,
  ) =>
    | { ok: true }
    | { ok: false; message: string }
  readOnly?: boolean
}

export function TaskDetailPanel({
  event,
  segments,
  userId,
  onClose,
  onChange,
  onDuplicate,
  onDeleteSegment,
  onDeleteTask,
  onToggleSegment,
  onToggleTask,
  todayDate,
  onReplan,
  readOnly = false,
}: Props) {
  const [title, setTitle] =
    useState(event.title)
  const [notes, setNotes] =
    useState(event.notes ?? '')
  const [date, setDate] =
    useState(event.date ?? toISODate(new Date()))
  const [time, setTime] =
    useState(formatTime(event.startMin))
  const [duration, setDuration] =
    useState(event.durationMin)
  const [category, setCategory] =
    useState<Category>(event.category)
  const [priority, setPriority] =
    useState<Priority>(event.priority ?? 'medium')
  const [projectId, setProjectId] =
    useState(event.projectId ?? '')
  const [projects, setProjects] =
    useState<Project[]>([])
  const [kind, setKind] =
    useState<EventKind>(event.kind)
  const [locked, setLocked] =
    useState(Boolean(event.locked))
  const [deadlineDate, setDeadlineDate] =
    useState(event.deadlineDate ?? '')
  const [windowStart, setWindowStart] =
    useState(
      formatTime(
        event.windowStartMin ?? START_MIN,
      ),
    )
  const [windowEnd, setWindowEnd] =
    useState(
      formatTime(
        event.windowEndMin ?? END_MIN,
      ),
    )
  const [energy, setEnergy] =
    useState<EnergyLevel>(
      event.energy ?? 'medium',
    )
  const [splittable, setSplittable] =
    useState(Boolean(event.splittable))
  const [minChunkMin, setMinChunkMin] =
    useState(event.minChunkMin ?? 45)
  const [replanDeadline, setReplanDeadline] =
    useState(() =>
      toISODate(
        addDays(fromISODate(todayDate), 7),
      ),
    )
  const [replanError, setReplanError] =
    useState<string | null>(null)
  const [
    constraintError,
    setConstraintError,
  ] = useState<string | null>(null)
  const [duplicateError, setDuplicateError] =
    useState<string | null>(null)

  const multiSegment =
    event.entityType === 'task' &&
    segments.length > 1
  const progress = taskProgress(segments)
  const overdue =
    event.entityType === 'task'
      ? taskOverdueState(
          segments.length > 0
            ? segments
            : [event],
          todayDate,
        )
      : null

  useEffect(() => {
    void listProjects(userId)
      .then((items) =>
        setProjects(
          items.filter(
            (project) =>
              !project.archived ||
              project.id === event.projectId,
          ),
        ),
      )
      .catch(() => setProjects([]))
  }, [userId, event.projectId])

  useEffect(() => {
    setTitle(event.title)
    setNotes(event.notes ?? '')
    setDate(event.date ?? toISODate(new Date()))
    setTime(formatTime(event.startMin))
    setDuration(event.durationMin)
    setCategory(event.category)
    setPriority(event.priority ?? 'medium')
    setProjectId(event.projectId ?? '')
    setKind(event.kind)
    setLocked(Boolean(event.locked))
    setDeadlineDate(
      event.deadlineDate ?? '',
    )
    setWindowStart(
      formatTime(
        event.windowStartMin ??
          START_MIN,
      ),
    )
    setWindowEnd(
      formatTime(
        event.windowEndMin ??
          END_MIN,
      ),
    )
    setEnergy(
      event.energy ?? 'medium',
    )
    setSplittable(
      Boolean(event.splittable) ||
        segments.length > 1,
    )
    setMinChunkMin(
      event.minChunkMin ?? 45,
    )
    setReplanDeadline(
      toISODate(
        addDays(fromISODate(todayDate), 7),
      ),
    )
    setReplanError(null)
    setConstraintError(null)
    setDuplicateError(null)
  }, [event, segments.length, todayDate])

  const replan = () => {
    const result = onReplan(
      event.id,
      replanDeadline,
    )

    if (!result.ok) {
      setReplanError(result.message)
      return
    }

    setReplanError(null)
  }

  const save = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setConstraintError('Choisissez une date valide avant d’enregistrer.')
      return
    }

    const nextDate = fromISODate(date)
    const isFlexibleTask =
      event.entityType === 'task' &&
      kind === 'flexible'

    const latestTaskDate = [
      date,
      ...segments
        .filter(
          (segment) =>
            segment.id !== event.id,
        )
        .map(
          (segment) =>
            segment.date,
        )
        .filter(
          (value): value is string =>
            Boolean(value),
        ),
    ].sort().at(-1) ?? date

    const nextWindowStart =
      parseTime(
        windowStart,
        START_MIN,
      )
    const nextWindowEnd =
      parseTime(
        windowEnd,
        END_MIN,
      )

    if (
      isFlexibleTask &&
      deadlineDate &&
      deadlineDate < latestTaskDate
    ) {
      setConstraintError(
        'L’échéance ne peut pas précéder le dernier bloc déjà planifié.',
      )
      return
    }

    if (
      isFlexibleTask &&
      nextWindowEnd <=
        nextWindowStart
    ) {
      setConstraintError(
        'La fin de la fenêtre horaire doit être postérieure à son début.',
      )
      return
    }

    setConstraintError(null)

    onChange(event.id, {
      title: title.trim() || event.title,
      notes: notes.trim() || undefined,
      date,
      day: weekdayIndex(nextDate),
      startMin: parseTime(
        time,
        event.startMin,
      ),
      durationMin: Math.max(
        15,
        duration,
      ),
      category,
      projectId:
        projectId || undefined,
      priority,
      kind,
      locked,
      deadlineDate:
        isFlexibleTask &&
        deadlineDate
          ? deadlineDate
          : undefined,
      deadlineDay:
        isFlexibleTask &&
        deadlineDate
          ? weekdayIndex(
              fromISODate(
                deadlineDate,
              ),
            )
          : undefined,
      windowStartMin:
        isFlexibleTask
          ? nextWindowStart
          : undefined,
      windowEndMin:
        isFlexibleTask
          ? nextWindowEnd
          : undefined,
      energy:
        isFlexibleTask
          ? energy
          : undefined,
      splittable:
        isFlexibleTask
          ? (
              multiSegment ||
              splittable
            )
          : undefined,
      minChunkMin:
        isFlexibleTask &&
        (
          multiSegment ||
          splittable
        )
          ? minChunkMin
          : undefined,
    })
    onClose()
  }

  const duplicate = () => {
    const result = onDuplicate(event.id)
    if (!result.ok) {
      setDuplicateError(result.message)
      return
    }

    setDuplicateError(null)
  }

  const removeSegment = () => {
    const label = multiSegment
      ? `${overdue ? 'Abandonner' : 'Supprimer'} uniquement ce bloc de « ${event.title} » ?`
      : `${overdue ? 'Abandonner' : 'Supprimer'} « ${event.title} » ?`

    if (!window.confirm(label)) return

    onDeleteSegment(event.id)
    onClose()
  }

  const removeTask = () => {
    if (
      !window.confirm(
        (overdue ? 'Abandonner' : 'Supprimer') +
          ' la tâche entière « ' +
          event.title +
          ' » et ses ' +
          segments.length +
          ' blocs ?',
      )
    ) {
      return
    }

    onDeleteTask(event.id)
    onClose()
  }

  return (
    <aside className={`task-detail-panel${readOnly ? ' read-only' : ''}`}>
      <div className="task-detail-head">
        <div>
          <span>
            {multiSegment
              ? 'TÂCHE FRACTIONNÉE'
              : 'DÉTAIL'}
          </span>
          <h2>
            {multiSegment
              ? 'Bloc ' +
                ((event.segmentIndex ?? 0) + 1) +
                '/' +
                segments.length
              : 'Modifier l’élément'}
          </h2>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Fermer"
        >
          <X size={18}/>
        </button>
      </div>

      {readOnly && (
        <p className="task-detail-readonly" role="status">
          Événement externe en lecture seule. Modifiez-le dans son agenda d’origine, puis synchronisez la source.
        </p>
      )}

      {overdue && (
        <section
          className="task-overdue-card"
          role="status"
        >
          <div className="task-overdue-head">
            <AlertTriangle size={18}/>
            <div>
              <strong>
                {overdueLabel(overdue.days)}
              </strong>
              <span>
                {overdue.remainingMinutes} min restantes · échéance du{' '}
                {new Intl.DateTimeFormat('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }).format(fromISODate(overdue.deadlineDate))}
              </span>
            </div>
          </div>

          {!readOnly &&
            event.kind === 'flexible' &&
            !segments.some((segment) => segment.locked) && (
              <div className="task-overdue-actions">
                <label>
                  <span>Nouvelle échéance</span>
                  <input
                    type="date"
                    min={todayDate}
                    value={replanDeadline}
                    onChange={(inputEvent) =>
                      setReplanDeadline(
                        inputEvent.target.value,
                      )}
                  />
                </label>
                <button
                  type="button"
                  className="btn primary"
                  disabled={!replanDeadline}
                  onClick={replan}
                >
                  <CalendarClock size={15}/>
                  Reporter et replanifier
                </button>
              </div>
            )}

          {!readOnly &&
            (event.kind !== 'flexible' ||
              segments.some((segment) => segment.locked)) && (
              <p>
                Modifiez manuellement la date ou déverrouillez la tâche avant de la replanifier.
              </p>
            )}

          {replanError && (
            <p className="planning-error" role="alert">
              {replanError}
            </p>
          )}
        </section>
      )}

      {multiSegment && (
        <section className="task-progress-card">
          <div className="task-progress-head">
            <div>
              <Layers3 size={17}/>
              <strong>Progression de la tâche</strong>
            </div>
            <span>{progress.percent}%</span>
          </div>
          <div className="task-progress-track">
            <i
              style={{
                width: progress.percent + '%',
              }}
            />
          </div>
          <p>
            {progress.completedSegments}/{progress.totalSegments}
            {' '}blocs terminés · {progress.completedDuration}/
            {progress.totalDuration} min
          </p>
          {!readOnly && <button
            type="button"
            className="task-progress-action"
            onClick={() => onToggleTask(event.id)}
          >
            <CheckCircle2 size={15}/>
            {progress.completed
              ? 'Rouvrir toute la tâche'
              : 'Terminer toute la tâche'}
          </button>}
        </section>
      )}

      <div className="task-detail-form">
        <label>
          <span>Titre</span>
          <input
            value={title}
            onChange={(event) =>
              setTitle(event.target.value)}
          />
        </label>

        <label>
          <span>Notes</span>
          <textarea
            value={notes}
            rows={4}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Contexte, résultat attendu, ressources…"
          />
        </label>

        <div className="task-detail-row">
          <label>
            <span>Date</span>
            <input
              type="date"
              value={date}
              onChange={(event) =>
                setDate(event.target.value)}
            />
          </label>

          <label>
            <span>Heure</span>
            <input
              type="time"
              step={900}
              value={time}
              onChange={(event) =>
                setTime(event.target.value)}
            />
          </label>
        </div>

        <div className="task-detail-row">
          <label>
            <span>Durée</span>
            <select
              value={duration}
              onChange={(event) =>
                setDuration(
                  Number(event.target.value),
                )}
            >
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>1 h</option>
              <option value={90}>1 h 30</option>
              <option value={120}>2 h</option>
              <option value={180}>3 h</option>
              <option value={240}>4 h</option>
            </select>
          </label>

          <label>
            <span>Type</span>
            <select
              value={kind}
              onChange={(event) =>
                setKind(
                  event.target.value as EventKind,
                )}
            >
              <option value="flexible">
                Flexible
              </option>
              <option value="fixed">
                Fixe
              </option>
            </select>
          </label>
        </div>

        <label>
          <span>Projet</span>
          <select
            value={projectId}
            onChange={(event) =>
              setProjectId(event.target.value)}
          >
            <option value="">
              Aucun projet
            </option>
            {projects.map((project) => (
              <option
                key={project.id}
                value={project.id}
              >
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <div className="task-detail-row">
          <label>
            <span>Catégorie</span>
            <select
              value={category}
              onChange={(event) =>
                setCategory(
                  event.target.value as Category,
                )}
            >
              <option value="course">Cours</option>
              <option value="project">Projet</option>
              <option value="personal">Personnel</option>
              <option value="focus">Focus</option>
              <option value="routine">Routine</option>
              <option value="admin">Administratif</option>
              <option value="neutral">Autre</option>
            </select>
          </label>

          <label>
            <span>Priorité</span>
            <select
              value={priority}
              onChange={(event) =>
                setPriority(
                  event.target.value as Priority,
                )}
            >
              <option value="low">Basse</option>
              <option value="medium">Moyenne</option>
              <option value="high">Haute</option>
            </select>
          </label>
        </div>

        {event.entityType === 'task' &&
          kind === 'flexible' && (
          <section className="task-constraint-editor">
            <div className="task-constraint-title">
              <strong>
                Contraintes de planification
              </strong>
              <span>
                {multiSegment
                  ? 'Appliquées à toute la tâche'
                  : 'Utilisées pour les propositions Horizon'}
              </span>
            </div>

            <label>
              <span>Échéance</span>
              <input
                type="date"
                min={
                  [
                    date,
                    ...segments
                      .filter(
                        (segment) =>
                          segment.id !==
                          event.id,
                      )
                      .map(
                        (segment) =>
                          segment.date,
                      )
                      .filter(
                        (
                          value,
                        ): value is string =>
                          Boolean(value),
                      ),
                  ]
                    .sort()
                    .at(-1) ?? date
                }
                value={deadlineDate}
                onChange={(inputEvent) =>
                  setDeadlineDate(
                    inputEvent.target.value,
                  )}
              />
            </label>

            <div className="task-detail-row">
              <label>
                <span>Au plus tôt</span>
                <input
                  type="time"
                  step={900}
                  value={windowStart}
                  onChange={(inputEvent) =>
                    setWindowStart(
                      inputEvent.target.value,
                    )}
                />
              </label>

              <label>
                <span>Au plus tard</span>
                <input
                  type="time"
                  step={900}
                  value={windowEnd}
                  onChange={(inputEvent) =>
                    setWindowEnd(
                      inputEvent.target.value,
                    )}
                />
              </label>
            </div>

            <label>
              <span>Niveau d’énergie</span>
              <select
                value={energy}
                onChange={(inputEvent) =>
                  setEnergy(
                    inputEvent.target.value as
                      EnergyLevel,
                  )}
              >
                <option value="low">
                  Faible
                </option>
                <option value="medium">
                  Moyen
                </option>
                <option value="high">
                  Élevé
                </option>
              </select>
            </label>

            <label className="task-detail-check">
              <input
                type="checkbox"
                checked={
                  multiSegment ||
                  splittable
                }
                disabled={multiSegment}
                onChange={(inputEvent) =>
                  setSplittable(
                    inputEvent.target.checked,
                  )}
              />
              <span>
                Fractionnable
                {multiSegment
                  ? ' · déjà répartie en plusieurs blocs'
                  : ''}
              </span>
            </label>

            {(multiSegment ||
              splittable) && (
              <label>
                <span>
                  Durée minimale d’un bloc
                </span>
                <select
                  value={minChunkMin}
                  onChange={(inputEvent) =>
                    setMinChunkMin(
                      Number(
                        inputEvent.target.value,
                      ),
                    )}
                >
                  <option value={15}>
                    15 min
                  </option>
                  <option value={30}>
                    30 min
                  </option>
                  <option value={45}>
                    45 min
                  </option>
                  <option value={60}>
                    1 h
                  </option>
                  <option value={90}>
                    1 h 30
                  </option>
                </select>
              </label>
            )}
          </section>
        )}

        {constraintError && (
          <p
            className="planning-error task-constraint-error"
            role="alert"
          >
            {constraintError}
          </p>
        )}

        <label className="task-detail-check">
          <input
            type="checkbox"
            checked={locked}
            onChange={(event) =>
              setLocked(event.target.checked)}
          />
          <Lock size={15}/>
          <span>
            Verrouiller les déplacements directs
          </span>
        </label>

        <label className="task-detail-check">
          <input
            type="checkbox"
            checked={Boolean(event.completed)}
            onChange={() =>
              onToggleSegment(event.id)}
          />
          <span>
            {multiSegment
              ? 'Ce bloc est terminé'
              : 'Terminée'}
          </span>
        </label>
      </div>

      {!readOnly && <div className="task-detail-actions">
        <div className="task-delete-group">
          {event.entityType === 'task' && (
            <button
              type="button"
              className="task-duplicate"
              onClick={duplicate}
            >
              <Copy size={16}/>
              Dupliquer
            </button>
          )}
          <button
            type="button"
            className="task-delete"
            onClick={removeSegment}
          >
            <Trash2 size={16}/>
            {multiSegment
              ? `${overdue ? 'Abandonner' : 'Supprimer'} ce bloc`
              : overdue
                ? 'Abandonner la tâche'
                : 'Supprimer'}
          </button>

          {multiSegment && (
            <button
              type="button"
              className="task-delete task-delete-all"
              onClick={removeTask}
            >
              <Trash2 size={16}/>
              {overdue
                ? 'Abandonner la tâche'
                : 'Supprimer la tâche'}
            </button>
          )}
        </div>

        <button
          type="button"
          className="btn primary"
          onClick={save}
        >
          Enregistrer
        </button>
      </div>}
      {duplicateError && (
        <p
          className="planning-error task-constraint-error"
          role="alert"
        >
          {duplicateError}
        </p>
      )}
    </aside>
  )
}
