import {
  CalendarPlus,
  Check,
  Circle,
  Filter,
  Inbox,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { CATEGORY_LABEL } from '../domain/constants'
import { groupTaskEvents, taskProgress } from '../domain/taskIdentity'
import type {
  Category,
  PlannerEvent,
  Priority,
} from '../domain/types'
import {
  completeInboxTask,
  createInboxTask,
  deleteInboxTask,
  listInboxTasks,
  markInboxTaskPlanned,
  type InboxTask,
} from '../data/taskInbox'
import {
  listProjects,
  type Project,
} from '../data/projects'
import {
  eventDateLabel,
  fromISODate,
  toISODate,
  weekdayIndex,
} from '../utils/date'
import { formatTime } from '../utils/time'

type FilterMode =
  | 'open'
  | 'all'
  | 'completed'

interface Props {
  userId: string
  events: PlannerEvent[]
  onToggleTask: (id: string) => void
  onSelect: (id: string) => void
  onCreateScheduled: (
    event: PlannerEvent,
  ) => void
}

const tomorrowDate = () => {
  const next = new Date()
  next.setDate(next.getDate() + 1)
  return toISODate(next)
}

export function TasksView({
  userId,
  events,
  onToggleTask,
  onSelect,
  onCreateScheduled,
}: Props) {
  const [filter, setFilter] =
    useState<FilterMode>('open')
  const [query, setQuery] =
    useState('')
  const [inbox, setInbox] =
    useState<InboxTask[]>([])
  const [projects, setProjects] =
    useState<Project[]>([])
  const [creating, setCreating] =
    useState(false)
  const [title, setTitle] =
    useState('')
  const [duration, setDuration] =
    useState(60)
  const [priority, setPriority] =
    useState<Priority>('medium')
  const [category, setCategory] =
    useState<Category>('neutral')
  const [projectId, setProjectId] =
    useState('')
  const [deadlineDate, setDeadlineDate] =
    useState('')
  const [busy, setBusy] =
    useState(false)
  const [error, setError] =
    useState<string | null>(null)

  const [planningId, setPlanningId] =
    useState<string | null>(null)
  const [planningDate, setPlanningDate] =
    useState(tomorrowDate)
  const [planningTime, setPlanningTime] =
    useState('09:00')

  const refreshInbox =
    useCallback(async () => {
      try {
        const next =
          await listInboxTasks(userId)
        setInbox(next)
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Impossible de charger les tâches non planifiées.',
        )
      }
    }, [userId])

  useEffect(() => {
    void Promise.all([
      refreshInbox(),
      listProjects(userId)
        .then((items) =>
          setProjects(
            items.filter(
              (project) =>
                !project.archived,
            ),
          ),
        )
        .catch(() => setProjects([])),
    ])
  }, [refreshInbox, userId])

  const scheduled = useMemo(() => {
    const normalized =
      query.trim().toLowerCase()

    return [...groupTaskEvents(events).entries()]
      .map(([taskId, segments]) => {
        const primary = segments[0]
        const progress = taskProgress(segments)
        const nextSegment =
          segments.find(
            (segment) => !segment.completed,
          ) ?? primary

        return {
          taskId,
          primary,
          nextSegment,
          progress,
        }
      })
      .filter(({ primary, progress }) => {
        if (
          filter === 'open' &&
          progress.completed
        ) {
          return false
        }

        if (
          filter === 'completed' &&
          !progress.completed
        ) {
          return false
        }

        return (
          !normalized ||
          primary.title
            .toLowerCase()
            .includes(normalized)
        )
      })
      .sort(
        (a, b) =>
          (a.nextSegment.date ?? '').localeCompare(
            b.nextSegment.date ?? '',
          ) ||
          a.nextSegment.startMin -
            b.nextSegment.startMin ||
          a.primary.title.localeCompare(
            b.primary.title,
          ),
      )
  }, [events, filter, query])

  const visibleInbox = useMemo(() => {
    if (filter === 'completed') {
      return []
    }

    const normalized =
      query.trim().toLowerCase()

    return inbox.filter(
      (task) =>
        !normalized ||
        task.title
          .toLowerCase()
          .includes(normalized),
    )
  }, [inbox, filter, query])

  const openCount =
    [...groupTaskEvents(events).values()]
      .filter(
        (segments) =>
          !taskProgress(segments).completed,
      ).length + inbox.length

  const create = async () => {
    if (!title.trim() || busy) return

    setBusy(true)
    setError(null)

    try {
      await createInboxTask(
        userId,
        {
          title: title.trim(),
          durationMin: duration,
          priority,
          category,
          projectId:
            projectId || undefined,
          deadlineDate:
            deadlineDate || undefined,
        },
      )

      setTitle('')
      setDuration(60)
      setPriority('medium')
      setCategory('neutral')
      setProjectId('')
      setDeadlineDate('')
      setCreating(false)
      await refreshInbox()
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

  const removeInbox = async (
    task: InboxTask,
  ) => {
    if (
      !window.confirm(
        `Supprimer « ${task.title} » ?`,
      )
    ) {
      return
    }

    setBusy(true)
    setError(null)

    try {
      await deleteInboxTask(task.id)
      setInbox((current) =>
        current.filter(
          (item) =>
            item.id !== task.id,
        ),
      )
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

  const completeInbox = async (
    task: InboxTask,
  ) => {
    setBusy(true)
    setError(null)

    try {
      await completeInboxTask(
        task.id,
      )
      setInbox((current) =>
        current.filter(
          (item) =>
            item.id !== task.id,
        ),
      )
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Mise à jour impossible.',
      )
    } finally {
      setBusy(false)
    }
  }

  const scheduleInbox = async (
    task: InboxTask,
  ) => {
    const [hour, minute] =
      planningTime
        .split(':')
        .map(Number)
    const startMin =
      hour * 60 + minute
    const date =
      fromISODate(planningDate)

    setBusy(true)
    setError(null)

    try {
      await markInboxTaskPlanned(
        task.id,
      )

      onCreateScheduled({
        id: task.id,
        title: task.title,
        date: planningDate,
        day: weekdayIndex(date),
        startMin,
        durationMin:
          task.durationMin,
        category:
          task.category,
        projectId:
          task.projectId ??
          undefined,
        priority:
          task.priority,
        kind: 'flexible',
        deadlineDate:
          task.deadlineDate ??
          undefined,
      })

      setInbox((current) =>
        current.filter(
          (item) =>
            item.id !== task.id,
        ),
      )
      setPlanningId(null)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Planification impossible.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="tasks-page">
      <header className="section-header">
        <div>
          <span className="section-kicker">
            EXÉCUTION
          </span>
          <h1>Tâches</h1>
          <p>
            {openCount} élément
            {openCount > 1 ? 's' : ''}{' '}
            à traiter.
          </p>
        </div>

        <div className="tasks-header-actions">
          <button
            className="btn primary"
            onClick={() =>
              setCreating(
                (value) => !value,
              )}
          >
            <Plus size={16}/>
            Nouvelle tâche
          </button>

          <div className="tasks-search">
            <Search size={17}/>
            <input
              value={query}
              onChange={(event) =>
                setQuery(
                  event.target.value,
                )}
              placeholder="Rechercher…"
            />
          </div>
        </div>
      </header>

      {creating && (
        <section className="task-inbox-create">
          <label className="task-inbox-title">
            <span>Titre</span>
            <input
              autoFocus
              value={title}
              onChange={(event) =>
                setTitle(
                  event.target.value,
                )}
              placeholder="Ex. Terminer le rapport"
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter'
                ) {
                  void create()
                }
              }}
            />
          </label>

          <label>
            <span>Durée</span>
            <select
              value={duration}
              onChange={(event) =>
                setDuration(
                  Number(
                    event.target.value,
                  ),
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
              <option value={180}>
                3 h
              </option>
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
              <option value="low">
                Basse
              </option>
              <option value="medium">
                Moyenne
              </option>
              <option value="high">
                Haute
              </option>
            </select>
          </label>

          <label>
            <span>Catégorie</span>
            <select
              value={category}
              onChange={(event) =>
                setCategory(
                  event.target.value as Category,
                )}
            >
              <option value="neutral">
                Autre
              </option>
              <option value="course">
                Cours
              </option>
              <option value="project">
                Projet
              </option>
              <option value="personal">
                Personnel
              </option>
              <option value="focus">
                Focus
              </option>
              <option value="admin">
                Administratif
              </option>
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

          <label>
            <span>
              Échéance facultative
            </span>
            <input
              type="date"
              value={deadlineDate}
              onChange={(event) =>
                setDeadlineDate(
                  event.target.value,
                )}
            />
          </label>

          <div className="task-inbox-create-actions">
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
                !title.trim()
              }
              onClick={() =>
                void create()}
            >
              Ajouter
            </button>
          </div>
        </section>
      )}

      <div className="tasks-toolbar">
        <Filter size={15}/>
        {([
          ['open', 'À faire'],
          ['all', 'Toutes'],
          ['completed', 'Terminées'],
        ] as const).map(
          ([value, label]) => (
            <button
              key={value}
              className={
                filter === value
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setFilter(value)}
            >
              {label}
            </button>
          ),
        )}
      </div>

      {visibleInbox.length > 0 && (
        <section className="task-inbox-section">
          <div className="task-list-heading">
            <div>
              <Inbox size={16}/>
              <strong>
                Non planifiées
              </strong>
            </div>
            <span>
              {visibleInbox.length}
            </span>
          </div>

          <div className="task-inbox-list">
            {visibleInbox.map(
              (task) => (
                <article
                  className="task-inbox-row"
                  key={task.id}
                >
                  <button
                    className="task-check"
                    disabled={busy}
                    onClick={() =>
                      void completeInbox(
                        task,
                      )}
                    aria-label="Marquer comme terminée"
                  >
                    <Circle size={15}/>
                  </button>

                  <div className="task-main">
                    <strong>
                      {task.title}
                    </strong>
                    <span>
                      {task.durationMin} min
                      {task.deadlineDate
                        ? ` · échéance ${new Intl.DateTimeFormat('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                          }).format(
                            fromISODate(
                              task.deadlineDate,
                            ),
                          )}`
                        : ''}
                    </span>
                  </div>

                  <span
                    className={
                      `task-category category-text-${task.category}`
                    }
                  >
                    {CATEGORY_LABEL[
                      task.category
                    ]}
                  </span>

                  <div className="task-inbox-actions">
                    <button
                      onClick={() => {
                        setPlanningId(
                          planningId ===
                            task.id
                            ? null
                            : task.id,
                        )
                      }}
                    >
                      <CalendarPlus size={15}/>
                      Planifier
                    </button>
                    <button
                      className="danger"
                      disabled={busy}
                      onClick={() =>
                        void removeInbox(
                          task,
                        )}
                    >
                      <Trash2 size={15}/>
                    </button>
                  </div>

                  {planningId ===
                    task.id && (
                    <div className="task-inline-schedule">
                      <input
                        type="date"
                        value={
                          planningDate
                        }
                        onChange={(
                          event,
                        ) =>
                          setPlanningDate(
                            event.target
                              .value,
                          )}
                      />
                      <input
                        type="time"
                        step={900}
                        value={
                          planningTime
                        }
                        onChange={(
                          event,
                        ) =>
                          setPlanningTime(
                            event.target
                              .value,
                          )}
                      />
                      <button
                        className="btn primary"
                        disabled={
                          busy ||
                          !planningDate
                        }
                        onClick={() =>
                          void scheduleInbox(
                            task,
                          )}
                      >
                        Ajouter au calendrier
                      </button>
                    </div>
                  )}
                </article>
              ),
            )}
          </div>
        </section>
      )}

      <section className="task-list-section">
        <div className="task-list-heading">
          <div>
            <Check size={16}/>
            <strong>
              Planifiées
            </strong>
          </div>
          <span>
            {scheduled.length}
          </span>
        </div>

        <section className="task-list">
          {scheduled.length === 0 ? (
            <div className="empty-state">
              <Check size={24}/>
              <strong>Rien ici.</strong>
              <span>
                Le planning est à jour pour ce filtre.
              </span>
            </div>
          ) : (
            scheduled.map(
              ({
                taskId,
                primary,
                nextSegment,
                progress,
              }) => (
                <article
                  key={taskId}
                  className={
                    'task-row ' +
                    (progress.completed
                      ? 'completed'
                      : '')
                  }
                  onClick={() =>
                    onSelect(
                      nextSegment.id,
                    )
                  }
                >
                  <button
                    className="task-check"
                    onClick={(
                      clickEvent,
                    ) => {
                      clickEvent.stopPropagation()
                      onToggleTask(
                        nextSegment.id,
                      )
                    }}
                    aria-label={
                      progress.completed
                        ? 'Rouvrir la tâche'
                        : 'Terminer toute la tâche'
                    }
                  >
                    {progress.completed
                      ? <Check size={15}/>
                      : <Circle size={15}/>}
                  </button>

                  <div className="task-main">
                    <strong>
                      {primary.title}
                    </strong>

                    {progress.totalSegments > 1 ? (
                      <>
                        <span>
                          {progress.totalSegments} blocs
                          {' · '}
                          {progress.completedSegments}/
                          {progress.totalSegments} terminés
                          {' · '}
                          {progress.totalDuration} min
                        </span>
                        <div
                          className="task-row-progress"
                          aria-label={
                            progress.percent +
                            '% terminé'
                          }
                        >
                          <i
                            style={{
                              width:
                                progress.percent +
                                '%',
                            }}
                          />
                        </div>
                        <small>
                          Prochain :{' '}
                          {eventDateLabel(
                            nextSegment,
                          )}
                          {' · '}
                          {formatTime(
                            nextSegment.startMin,
                          )}
                        </small>
                      </>
                    ) : (
                      <span>
                        {eventDateLabel(
                          nextSegment,
                        )}
                        {' · '}
                        {formatTime(
                          nextSegment.startMin,
                        )}
                        {' · '}
                        {nextSegment.durationMin}{' '}
                        min
                      </span>
                    )}
                  </div>

                  <span
                    className={
                      'task-category category-text-' +
                      primary.category
                    }
                  >
                    {CATEGORY_LABEL[
                      primary.category
                    ]}
                  </span>

                  <span
                    className={
                      'task-kind kind-' +
                      primary.kind
                    }
                  >
                    {progress.totalSegments > 1
                      ? progress.completedSegments +
                        '/' +
                        progress.totalSegments +
                        ' blocs'
                      : primary.kind ===
                          'fixed'
                        ? 'Fixe'
                        : 'Flexible'}
                  </span>
                </article>
              ),
            )
          )}
        </section>
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
