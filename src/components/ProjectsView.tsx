import {
  Archive,
  FolderKanban,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { PlannerEvent } from '../domain/types'
import {
  createProject,
  deleteProject,
  listProjects,
  updateProject,
  type Project,
} from '../data/projects'

interface Props {
  userId: string
  events: PlannerEvent[]
  onProjectsChange?: (
    projects: Project[],
  ) => void
}

export function ProjectsView({
  userId,
  events,
  onProjectsChange,
}: Props) {
  const [projects, setProjects] =
    useState<Project[]>([])
  const [creating, setCreating] =
    useState(false)
  const [name, setName] =
    useState('')
  const [description, setDescription] =
    useState('')
  const [busy, setBusy] =
    useState(false)
  const [error, setError] =
    useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const next =
        await listProjects(userId)
      setProjects(next)
      onProjectsChange?.(next)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossible de charger les projets.',
      )
    }
  }, [userId, onProjectsChange])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const counts = useMemo(() => {
    const map = new Map<string, number>()

    for (const event of events) {
      if (!event.projectId) continue
      map.set(
        event.projectId,
        (map.get(event.projectId) ?? 0) + 1,
      )
    }

    return map
  }, [events])

  const create = async () => {
    const normalized = name.trim()
    if (!normalized || busy) return

    setBusy(true)
    setError(null)

    try {
      await createProject(userId, {
        name: normalized,
        description,
      })
      setName('')
      setDescription('')
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

  const toggleArchived = async (
    project: Project,
  ) => {
    setBusy(true)
    setError(null)

    try {
      await updateProject(
        project.id,
        {
          archived:
            !project.archived,
        },
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
    project: Project,
  ) => {
    if (
      !window.confirm(
        `Supprimer le projet « ${project.name} » ? Les tâches resteront dans Horizon mais ne seront plus rattachées à ce projet.`,
      )
    ) {
      return
    }

    setBusy(true)
    setError(null)

    try {
      await deleteProject(project.id)
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
    <main className="projects-page">
      <header className="section-header">
        <div>
          <span className="section-kicker">
            CONSTRUCTION
          </span>
          <h1>Projets</h1>
          <p>
            De vrais espaces de travail auxquels
            vos tâches peuvent être rattachées.
          </p>
        </div>

        <button
          className="btn primary"
          onClick={() =>
            setCreating((value) => !value)}
        >
          <Plus size={16}/>
          Nouveau projet
        </button>
      </header>

      {creating && (
        <section className="project-create">
          <label>
            <span>Nom</span>
            <input
              autoFocus
              value={name}
              onChange={(event) =>
                setName(event.target.value)}
              placeholder="Ex. Horizon"
            />
          </label>

          <label>
            <span>Description</span>
            <input
              value={description}
              onChange={(event) =>
                setDescription(
                  event.target.value,
                )}
              placeholder="Objectif du projet"
            />
          </label>

          <div className="project-create-actions">
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
                busy || !name.trim()
              }
              onClick={() => void create()}
            >
              Créer
            </button>
          </div>
        </section>
      )}

      <section className="project-grid-real">
        {projects.length === 0 ? (
          <div className="empty-state">
            <FolderKanban size={25}/>
            <strong>
              Aucun projet.
            </strong>
            <span>
              Créez votre premier projet pour
              regrouper des tâches.
            </span>
          </div>
        ) : (
          projects.map((project) => (
            <article
              key={project.id}
              className={[
                'project-card-real',
                project.archived
                  ? 'archived'
                  : '',
              ].filter(Boolean).join(' ')}
              style={{
                borderTopColor:
                  project.color ||
                  '#FF6200',
              }}
            >
              <div>
                <span>
                  {project.archived
                    ? 'ARCHIVÉ'
                    : 'PROJET'}
                </span>
                <h2>{project.name}</h2>
                <p>
                  {project.description ||
                    'Aucune description.'}
                </p>
              </div>

              <div className="project-card-meta">
                <strong>
                  {counts.get(project.id) ?? 0}
                </strong>
                <span>
                  éléments planifiés
                </span>
              </div>

              <div className="project-card-actions">
                <button
                  disabled={busy}
                  onClick={() =>
                    void toggleArchived(
                      project,
                    )}
                >
                  <Archive size={15}/>
                  {project.archived
                    ? 'Réactiver'
                    : 'Archiver'}
                </button>
                <button
                  className="danger"
                  disabled={busy}
                  onClick={() =>
                    void remove(project)}
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
