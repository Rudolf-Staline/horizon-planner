import {
  CalendarX2,
  Check,
  Pencil,
  PauseCircle,
  PlayCircle,
  Plus,
  Repeat2,
  Trash2,
  X,
} from 'lucide-react'
import {
  useEffect,
  useState,
} from 'react'
import {
  createRoutine,
  deleteRoutine,
  deleteRoutineException,
  listRoutineExceptions,
  listRoutines,
  setRoutineActive,
  updateRoutine,
  upsertRoutineException,
  type Routine,
  type RoutineException,
} from '../data/routines'
import {
  listProjects,
  type Project,
} from '../data/projects'

const DAY_LABELS = [
  'L',
  'M',
  'M',
  'J',
  'V',
  'S',
  'D',
]

interface Props {
  userId: string
  routines: Routine[]
  exceptions: RoutineException[]
  onChange: (routines: Routine[]) => void
  onExceptionsChange: (
    exceptions: RoutineException[],
  ) => void
}

type Draft = {
  title: string
  duration: number
  time: string
  days: number[]
  projectId: string
}

const emptyDraft = (): Draft => ({
  title: '',
  duration: 45,
  time: '08:00',
  days: [0, 1, 2, 3, 4],
  projectId: '',
})

export function RoutinesView({
  userId,
  routines,
  exceptions,
  onChange,
  onExceptionsChange,
}: Props) {
  const [creating, setCreating] =
    useState(false)
  const [editingId, setEditingId] =
    useState<string | null>(null)
  const [draft, setDraft] =
    useState<Draft>(emptyDraft)
  const [projects, setProjects] =
    useState<Project[]>([])
  const [busy, setBusy] =
    useState(false)
  const [error, setError] =
    useState<string | null>(null)
  const [exceptionRoutineId, setExceptionRoutineId] =
    useState('')
  const [exceptionDate, setExceptionDate] =
    useState('')
  const [exceptionAction, setExceptionAction] =
    useState<'skip' | 'override'>('skip')
  const [exceptionTime, setExceptionTime] =
    useState('08:00')
  const [exceptionDuration, setExceptionDuration] =
    useState(45)

  useEffect(() => {
    void listProjects(userId)
      .then((items) =>
        setProjects(
          items.filter(
            (project) =>
              !project.archived,
          ),
        ),
      )
      .catch(() => setProjects([]))
  }, [userId])

  const refresh = async () => {
    const next =
      await listRoutines(userId)
    onChange(next)
  }

  const refreshExceptions = async () => {
    const next =
      await listRoutineExceptions(userId)
    onExceptionsChange(next)
  }

  const saveException = async () => {
    if (
      !exceptionRoutineId ||
      !exceptionDate ||
      busy
    ) {
      return
    }

    setBusy(true)
    setError(null)

    try {
      await upsertRoutineException(
        userId,
        {
          routineId: exceptionRoutineId,
          occursOn: exceptionDate,
          action: exceptionAction,
          overrideStart:
            exceptionAction === 'override'
              ? exceptionTime
              : null,
          overrideDurationMin:
            exceptionAction === 'override'
              ? exceptionDuration
              : null,
        },
      )

      setExceptionDate('')
      setExceptionAction('skip')
      await refreshExceptions()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Exception impossible à enregistrer.',
      )
    } finally {
      setBusy(false)
    }
  }

  const removeException = async (
    exceptionId: string,
  ) => {
    setBusy(true)
    setError(null)

    try {
      await deleteRoutineException(
        exceptionId,
      )
      await refreshExceptions()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Suppression de l’exception impossible.',
      )
    } finally {
      setBusy(false)
    }
  }

  const toggleDay = (day: number) => {
    setDraft((current) => ({
      ...current,
      days:
        current.days.includes(day)
          ? current.days.filter(
              (value) =>
                value !== day,
            )
          : [
              ...current.days,
              day,
            ].sort(),
    }))
  }

  const openCreate = () => {
    setEditingId(null)
    setDraft(emptyDraft())
    setCreating(true)
    setError(null)
  }

  const openEdit = (
    routine: Routine,
  ) => {
    setCreating(false)
    setEditingId(routine.id)
    setDraft({
      title: routine.title,
      duration:
        routine.durationMin,
      time:
        routine.preferredStart
          ?.slice(0, 5) ||
        '08:00',
      days: [...routine.days],
      projectId:
        routine.projectId ?? '',
    })
    setError(null)
  }

  const closeEditor = () => {
    setCreating(false)
    setEditingId(null)
    setDraft(emptyDraft())
  }

  const submit = async () => {
    if (
      !draft.title.trim() ||
      draft.days.length === 0 ||
      busy
    ) {
      return
    }

    setBusy(true)
    setError(null)

    try {
      if (editingId) {
        await updateRoutine(
          editingId,
          {
            title:
              draft.title.trim(),
            projectId:
              draft.projectId ||
              null,
            durationMin:
              draft.duration,
            days: draft.days,
            preferredStart:
              draft.time,
          },
        )
      } else {
        await createRoutine(
          userId,
          {
            title:
              draft.title.trim(),
            projectId:
              draft.projectId ||
              undefined,
            durationMin:
              draft.duration,
            days: draft.days,
            preferredStart:
              draft.time,
          },
        )
      }

      closeEditor()
      await refresh()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Enregistrement impossible.',
      )
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async (
    routine: Routine,
  ) => {
    setBusy(true)
    setError(null)

    try {
      await setRoutineActive(
        routine.id,
        !routine.active,
      )
      await refresh()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Modification impossible.',
      )
    } finally {
      setBusy(false)
    }
  }

  const remove = async (
    routine: Routine,
  ) => {
    if (
      !window.confirm(
        `Supprimer la routine « ${routine.title} » ?`,
      )
    ) {
      return
    }

    setBusy(true)
    setError(null)

    try {
      await deleteRoutine(
        routine.id,
      )
      await refresh()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Suppression impossible.',
      )
    } finally {
      setBusy(false)
    }
  }

  const showEditor =
    creating || editingId !== null

  return (
    <main className="routines-page">
      <header className="section-header">
        <div>
          <span className="section-kicker">
            RÉPÉTITION
          </span>
          <h1>Routines</h1>
          <p>
            Définissez une fois vos habitudes ;
            Horizon les projette automatiquement
            sur les bonnes dates.
          </p>
        </div>

        <button
          className="btn primary"
          onClick={openCreate}
        >
          <Plus size={16}/>
          Nouvelle routine
        </button>
      </header>

      {showEditor && (
        <section className="routine-create">
          <div className="routine-editor-head">
            <strong>
              {editingId
                ? 'Modifier la routine'
                : 'Nouvelle routine'}
            </strong>
            <button
              className="icon-button"
              onClick={closeEditor}
              aria-label="Fermer"
            >
              <X size={17}/>
            </button>
          </div>

          <label className="routine-title-field">
            <span>Nom</span>
            <input
              autoFocus
              value={draft.title}
              onChange={(event) =>
                setDraft(
                  (current) => ({
                    ...current,
                    title:
                      event.target.value,
                  }),
                )}
              placeholder="Ex. Sport"
            />
          </label>

          <label>
            <span>Heure</span>
            <input
              type="time"
              step={900}
              value={draft.time}
              onChange={(event) =>
                setDraft(
                  (current) => ({
                    ...current,
                    time:
                      event.target.value,
                  }),
                )}
            />
          </label>

          <label>
            <span>Durée</span>
            <select
              value={draft.duration}
              onChange={(event) =>
                setDraft(
                  (current) => ({
                    ...current,
                    duration:
                      Number(
                        event.target.value,
                      ),
                  }),
                )}
            >
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
              <option value={120}>
                2 h
              </option>
            </select>
          </label>

          <label>
            <span>Projet</span>
            <select
              value={draft.projectId}
              onChange={(event) =>
                setDraft(
                  (current) => ({
                    ...current,
                    projectId:
                      event.target.value,
                  }),
                )}
            >
              <option value="">
                Aucun
              </option>
              {projects.map(
                (project) => (
                  <option
                    key={project.id}
                    value={project.id}
                  >
                    {project.name}
                  </option>
                ),
              )}
            </select>
          </label>

          <div className="routine-days">
            {DAY_LABELS.map(
              (label, day) => (
                <button
                  key={day}
                  type="button"
                  className={
                    draft.days.includes(
                      day,
                    )
                      ? 'selected'
                      : ''
                  }
                  onClick={() =>
                    toggleDay(day)}
                >
                  {label}
                </button>
              ),
            )}
          </div>

          <div className="routine-create-actions">
            <button
              className="btn secondary"
              onClick={closeEditor}
            >
              Annuler
            </button>
            <button
              className="btn primary"
              disabled={
                busy ||
                !draft.title.trim() ||
                draft.days.length === 0
              }
              onClick={() =>
                void submit()}
            >
              <Check size={15}/>
              {editingId
                ? 'Enregistrer'
                : 'Créer'}
            </button>
          </div>
        </section>
      )}

      <section className="routine-list-real">
        {routines.length === 0 ? (
          <div className="empty-state">
            <Repeat2 size={24}/>
            <strong>
              Aucune routine.
            </strong>
            <span>
              Ajoutez une habitude récurrente.
            </span>
          </div>
        ) : (
          routines.map((routine) => (
            <article
              key={routine.id}
              className={
                `routine-row-real ${routine.active ? '' : 'inactive'}`
              }
            >
              <div className="routine-main">
                <strong>
                  {routine.title}
                </strong>
                <span>
                  {routine.days
                    .map(
                      (day) =>
                        [
                          'Lun',
                          'Mar',
                          'Mer',
                          'Jeu',
                          'Ven',
                          'Sam',
                          'Dim',
                        ][day],
                    )
                    .join(' · ')}
                </span>
              </div>

              <div className="routine-time">
                <strong>
                  {routine.preferredStart
                    ?.slice(0, 5) ||
                    '08:00'}
                </strong>
                <span>
                  {routine.durationMin} min
                </span>
              </div>

              <span
                className={
                  routine.active
                    ? 'routine-state active'
                    : 'routine-state'
                }
              >
                {routine.active
                  ? 'Active'
                  : 'En pause'}
              </span>

              <div className="routine-actions">
                <button
                  disabled={busy}
                  onClick={() =>
                    openEdit(routine)}
                >
                  <Pencil size={15}/>
                  Modifier
                </button>

                <button
                  disabled={busy}
                  onClick={() =>
                    void toggleActive(
                      routine,
                    )}
                >
                  {routine.active
                    ? <PauseCircle size={15}/>
                    : <PlayCircle size={15}/>}
                  {routine.active
                    ? 'Pause'
                    : 'Activer'}
                </button>

                <button
                  className="danger"
                  disabled={busy}
                  onClick={() =>
                    void remove(routine)}
                >
                  <Trash2 size={15}/>
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="routine-exceptions">
        <div className="routine-exception-head">
          <div>
            <CalendarX2 size={18}/>
            <div>
              <strong>Exceptions ponctuelles</strong>
              <span>
                Ignorez une occurrence ou modifiez seulement
                une date sans toucher à toute la série.
              </span>
            </div>
          </div>
        </div>

        <div className="routine-exception-form">
          <select
            value={exceptionRoutineId}
            onChange={(event) =>
              setExceptionRoutineId(
                event.target.value,
              )}
          >
            <option value="">
              Choisir une routine
            </option>
            {routines.map((routine) => (
              <option
                key={routine.id}
                value={routine.id}
              >
                {routine.title}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={exceptionDate}
            onChange={(event) =>
              setExceptionDate(
                event.target.value,
              )}
          />

          <select
            value={exceptionAction}
            onChange={(event) =>
              setExceptionAction(
                event.target.value as
                  'skip' | 'override',
              )}
          >
            <option value="skip">
              Ignorer cette occurrence
            </option>
            <option value="override">
              Modifier cette occurrence
            </option>
          </select>

          {exceptionAction === 'override' && (
            <>
              <input
                type="time"
                step={900}
                value={exceptionTime}
                onChange={(event) =>
                  setExceptionTime(
                    event.target.value,
                  )}
              />
              <select
                value={exceptionDuration}
                onChange={(event) =>
                  setExceptionDuration(
                    Number(
                      event.target.value,
                    ),
                  )}
              >
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>1 h</option>
                <option value={90}>1 h 30</option>
                <option value={120}>2 h</option>
              </select>
            </>
          )}

          <button
            className="btn primary"
            disabled={
              busy ||
              !exceptionRoutineId ||
              !exceptionDate
            }
            onClick={() =>
              void saveException()}
          >
            Enregistrer
          </button>
        </div>

        {exceptions.length > 0 && (
          <div className="routine-exception-list">
            {exceptions.map((exception) => {
              const routine =
                routines.find(
                  (item) =>
                    item.id ===
                    exception.routineId,
                )

              return (
                <article key={exception.id}>
                  <div>
                    <strong>
                      {routine?.title ??
                        'Routine'}
                    </strong>
                    <span>
                      {new Intl.DateTimeFormat(
                        'fr-FR',
                        {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        },
                      ).format(
                        new Date(
                          exception.occursOn +
                            'T12:00:00',
                        ),
                      )}
                      {' · '}
                      {exception.action ===
                      'skip'
                        ? 'ignorée'
                        : 'modifiée'}
                      {exception.action ===
                          'override' &&
                        exception.overrideStart
                        ? ' · ' +
                          exception.overrideStart.slice(
                            0,
                            5,
                          )
                        : ''}
                    </span>
                  </div>

                  <button
                    className="danger"
                    disabled={busy}
                    onClick={() =>
                      void removeException(
                        exception.id,
                      )}
                  >
                    <Trash2 size={15}/>
                  </button>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {error && (
        <p
          className="planning-error"
          role="alert"
        >
          {error}
        </p>
      )}
    </main>
  )
}
