import {
  Archive,
  Check,
  FolderKanban,
  Pencil,
  Plus,
  Trash2,
  X,
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
}

type ProjectDraft = {
  name: string
  description: string
  color: string
}

const emptyDraft = (): ProjectDraft => ({
  name: '',
  description: '',
  color: '#FF6200',
})

export function ProjectsView({
  userId,
  events,
}: Props) {
  const [projects, setProjects] =
    useState<Project[]>([])
  const [creating, setCreating] =
    useState(false)
  const [editingId, setEditingId] =
    useState<string | null>(null)
  const [draft, setDraft] =
    useState<ProjectDraft>(
      emptyDraft,
    )
  const [busy, setBusy] =
    useState(false)
  const [error, setError] =
    useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const next =
        await listProjects(userId)
      setProjects(next)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossible de charger les projets.',
      )
    }
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const counts = useMemo(() => {
    const map = new Map<string, number>()

    for (const event of events) {
      if (!event.projectId) continue

      map.set(
        event.projectId,
        (map.get(event.projectId) ?? 0) +
          1,
      )
    }

    return map
  }, [events])

  const openCreate = () => {
    setEditingId(null)
    setDraft(emptyDraft())
    setCreating(true)
    setError(null)
  }

  const openEdit = (
    project: Project,
  ) => {
    setCreating(false)
    setEditingId(project.id)
    setDraft({
      name: project.name,
      description:
        project.description ?? '',
      color:
        project.color || '#FF6200',
    })
    setError(null)
  }

  const closeEditor = () => {
    setCreating(false)
    setEditingId(null)
    setDraft(emptyDraft())
  }

  const save = async () => {
    const name = draft.name.trim()
    if (!name || busy) return

    setBusy(true)
    setError(null)

    try {
      if (editingId) {
        await updateProject(
          editingId,
          {
            name,
            description:
              draft.description.trim() ||
              null,
            color: draft.color,
          },
        )
      } else {
        await createProject(
          userId,
          {
            name,
            description:
              draft.description,
            color: draft.color,
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

  const showEditor =
    creating || editingId !== null

  return (
    <main className="projects-page">
      <header className="section-header">
        <div>
          <span className="section-kicker">
            CONSTRUCTION
          </span>
          <h1>Projets</h1>
          <p>
            Espaces de travail auxquels vos
            tâches et routines peuvent être
            rattachées.
          </p>
        </div>

        <button
          className="btn primary"
          onClick={openCreate}
        >
          <Plus size={16}/>
          Nouveau projet
        </button>
      </header>

      {showEditor && (
        <section className="project-create">
          <div className="project-editor-head">
            <strong>
              {editingId
                ? 'Modifier le projet'
                : 'Nouveau projet'}
            </strong>
            <button
              className="icon-button"
              onClick={closeEditor}
              aria-label="Fermer"
            >
              <X size={17}/>
            </button>
          </div>

          <label>
            <span>Nom</span>
            <input
              autoFocus
              value={draft.name}
              onChange={(event) =>
                setDraft(
                  (current) => ({
                    ...current,
                    name:
                      event.target.value,
                  }),
                )}
              placeholder="Ex. Horizon"
            />
          </label>

          <label>
            <span>Description</span>
            <input
              value={
                draft.description
              }
              onChange={(event) =>
                setDraft(
                  (current) => ({
                    ...current,
                    description:
                      event.target.value,
                  }),
                )}
              placeholder="Objectif du projet"
            />
          </label>

          <label className="project-color-field">
            <span>Couleur</span>
            <input
              type="color"
              value={draft.color}
              onChange={(event) =>
                setDraft(
                  (current) => ({
                    ...current,
                    color:
                      event.target.value,
                  }),
                )}
            />
          </label>

          <div className="project-create-actions">
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
                !draft.name.trim()
              }
              onClick={() =>
                void save()}
            >
              <Check size={15}/>
              {editingId
                ? 'Enregistrer'
                : 'Créer'}
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
              ]
                .filter(Boolean)
                .join(' ')}
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
                    openEdit(project)}
                >
                  <Pencil size={15}/>
                  Modifier
                </button>
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
