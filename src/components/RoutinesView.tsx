import {
  PauseCircle,
  PlayCircle,
  Plus,
  Repeat2,
  Trash2,
} from 'lucide-react'
import {
  useEffect,
  useState,
} from 'react'
import {
  createRoutine,
  deleteRoutine,
  listRoutines,
  setRoutineActive,
  type Routine,
} from '../data/routines'
import {
  listProjects,
  type Project,
} from '../data/projects'

const DAYS = [
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
  onChange: (routines: Routine[]) => void
}

export function RoutinesView({
  userId,
  routines,
  onChange,
}: Props) {
  const [creating, setCreating] =
    useState(false)
  const [title, setTitle] =
    useState('')
  const [duration, setDuration] =
    useState(45)
  const [time, setTime] =
    useState('08:00')
  const [days, setDays] =
    useState<number[]>([
      0, 1, 2, 3, 4,
    ])
  const [projectId, setProjectId] =
    useState('')
  const [projects, setProjects] =
    useState<Project[]>([])
  const [busy, setBusy] =
    useState(false)
  const [error, setError] =
    useState<string | null>(null)

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

  const toggleDay = (day: number) => {
    setDays((current) =>
      current.includes(day)
        ? current.filter(
            (value) =>
              value !== day,
          )
        : [...current, day].sort(),
    )
  }

  const create = async () => {
    if (
      !title.trim() ||
      days.length === 0 ||
      busy
    ) {
      return
    }

    setBusy(true)
    setError(null)

    try {
      await createRoutine(
        userId,
        {
          title: title.trim(),
          projectId:
            projectId || undefined,
          durationMin: duration,
          days,
          preferredStart: time,
        },
      )

      setTitle('')
      setCreating(false)
      await refresh()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Création impossible.',
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
      await deleteRoutine(routine.id)
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
          onClick={() =>
            setCreating((value) => !value)}
        >
          <Plus size={16}/>
          Nouvelle routine
        </button>
      </header>

      {creating && (
        <section className="routine-create">
          <label className="routine-title-field">
            <span>Nom</span>
            <input
              autoFocus
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)}
              placeholder="Ex. Sport"
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

          <label>
            <span>Durée</span>
            <select
              value={duration}
              onChange={(event) =>
                setDuration(
                  Number(event.target.value),
                )}
            >
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>1 h</option>
              <option value={90}>1 h 30</option>
              <option value={120}>2 h</option>
            </select>
          </label>

          <label>
            <span>Projet</span>
            <select
              value={projectId}
              onChange={(event) =>
                setProjectId(
                  event.target.value,
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
            {DAYS.map((label, day) => (
              <button
                key={day}
                type="button"
                className={
                  days.includes(day)
                    ? 'selected'
                    : ''
                }
                onClick={() =>
                  toggleDay(day)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="routine-create-actions">
            <button
              className="btn secondary"
              onClick={() =>
                setCreating(false)}
            >
              Annuler
            </button>
            <button
              className="btn primary"
              disabled={
                busy ||
                !title.trim() ||
                days.length === 0
              }
              onClick={() => void create()}
            >
              Créer
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
                  Supprimer
                </button>
              </div>
            </article>
          ))
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
