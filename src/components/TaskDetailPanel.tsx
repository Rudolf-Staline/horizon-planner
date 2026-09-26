import { Lock, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type {
  Category,
  EventKind,
  PlannerEvent,
  Priority,
} from '../domain/types'
import {
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
  userId: string
  onClose: () => void
  onChange: (
    id: string,
    patch: Partial<PlannerEvent>,
  ) => void
  onDelete: (id: string) => void
  onToggleCompleted: (id: string) => void
}

export function TaskDetailPanel({
  event,
  userId,
  onClose,
  onChange,
  onDelete,
  onToggleCompleted,
}: Props) {
  const [title, setTitle] =
    useState(event.title)
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
    setDate(event.date ?? toISODate(new Date()))
    setTime(formatTime(event.startMin))
    setDuration(event.durationMin)
    setCategory(event.category)
    setPriority(event.priority ?? 'medium')
    setProjectId(event.projectId ?? '')
    setKind(event.kind)
    setLocked(Boolean(event.locked))
  }, [event])

  const save = () => {
    const nextDate = fromISODate(date)

    onChange(event.id, {
      title: title.trim() || event.title,
      date,
      day: weekdayIndex(nextDate),
      startMin: parseTime(time, event.startMin),
      durationMin: Math.max(15, duration),
      category,
      projectId: projectId || undefined,
      priority,
      kind,
      locked,
    })
  }

  const remove = () => {
    if (
      !window.confirm(
        `Supprimer « ${event.title} » ?`,
      )
    ) {
      return
    }

    onDelete(event.id)
    onClose()
  }

  return (
    <aside className="task-detail-panel">
      <div className="task-detail-head">
        <div>
          <span>DÉTAIL</span>
          <h2>Modifier l’élément</h2>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Fermer"
        >
          <X size={18}/>
        </button>
      </div>

      <div className="task-detail-form">
        <label>
          <span>Titre</span>
          <input
            value={title}
            onChange={(event) =>
              setTitle(event.target.value)}
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
              onToggleCompleted(event.id)}
          />
          <span>Terminée</span>
        </label>
      </div>

      <div className="task-detail-actions">
        <button
          className="task-delete"
          onClick={remove}
        >
          <Trash2 size={16}/>
          Supprimer
        </button>

        <button
          className="btn primary"
          onClick={save}
        >
          Enregistrer
        </button>
      </div>
    </aside>
  )
}
