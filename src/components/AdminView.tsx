import {
  Ban,
  Database,
  Eye,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  adminCreateUser,
  adminDeleteUser,
  adminSetRole,
  adminSetSuspended,
  listAdminUsers,
  loadAdminStats,
  loadAdminUserOverview,
  type AdminStats,
  type AdminUser,
  type AdminUserOverview,
} from '../data/admin'

function formatDate(value: string | null) {
  if (!value) return 'Jamais'

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function isSuspended(user: AdminUser) {
  if (!user.bannedUntil) return false
  return new Date(user.bannedUntil).getTime() > Date.now()
}

export function AdminView() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [selectedDataUser, setSelectedDataUser] =
    useState<AdminUser | null>(null)
  const [userOverview, setUserOverview] =
    useState<AdminUserOverview | null>(null)
  const [overviewLoading, setOverviewLoading] =
    useState(false)

  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [usersResult, statsResult] = await Promise.all([
        listAdminUsers(),
        loadAdminStats(),
      ])

      setUsers(usersResult.users)
      setStats(statsResult)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossible de charger l’administration.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const activeUsers = useMemo(
    () => users.filter((user) => !isSuspended(user)).length,
    [users],
  )

  const runForUser = async (
    userId: string,
    operation: () => Promise<unknown>,
    successMessage: string,
  ) => {
    setBusyId(userId)
    setError(null)
    setNotice(null)

    try {
      await operation()
      setNotice(successMessage)
      await refresh()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Opération impossible.',
      )
    } finally {
      setBusyId(null)
    }
  }

  const inspectUserData = async (
    user: AdminUser,
  ) => {
    setSelectedDataUser(user)
    setUserOverview(null)
    setOverviewLoading(true)
    setError(null)

    try {
      const overview =
        await loadAdminUserOverview(user.id)
      setUserOverview(overview)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossible de charger les données utilisateur.',
      )
    } finally {
      setOverviewLoading(false)
    }
  }

  const createUser = async () => {
    if (!email.trim() || password.length < 8) return

    setBusyId('create')
    setError(null)
    setNotice(null)

    try {
      await adminCreateUser({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
      })

      setEmail('')
      setDisplayName('')
      setPassword('')
      setNotice('Utilisateur créé.')
      await refresh()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Création impossible.',
      )
    } finally {
      setBusyId(null)
    }
  }

  const deleteUser = async (user: AdminUser) => {
    const accepted = window.confirm(
      `Supprimer définitivement le compte ${user.email ?? user.id} ? Ses données Horizon seront également supprimées.`,
    )

    if (!accepted) return

    await runForUser(
      user.id,
      () => adminDeleteUser(user.id),
      'Utilisateur supprimé.',
    )
  }

  return (
    <main className="admin-page">
      <header className="section-header">
        <div>
          <span className="section-kicker">ADMINISTRATION</span>
          <h1>Utilisateurs & données</h1>
          <p>
            Gestion des comptes Horizon et supervision de la base applicative.
          </p>
        </div>

        <button
          className="admin-refresh"
          onClick={() => void refresh()}
          disabled={loading}
        >
          <RefreshCw size={16}/>
          Actualiser
        </button>
      </header>

      <section className="admin-metrics">
        <article><Users size={19}/><span>Utilisateurs</span><strong>{users.length}</strong></article>
        <article><ShieldCheck size={19}/><span>Comptes actifs</span><strong>{activeUsers}</strong></article>
        <article><Database size={19}/><span>Tâches</span><strong>{stats?.tasks ?? '—'}</strong></article>
        <article><Database size={19}/><span>Segments</span><strong>{stats?.plannedSegments ?? '—'}</strong></article>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <h2>Créer un utilisateur</h2>
            <p>
              Le compte est créé avec une adresse confirmée et un mot de passe initial.
            </p>
          </div>
          <UserPlus size={20}/>
        </div>

        <div className="admin-create-grid">
          <input
            placeholder="Nom affiché"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <input
            type="email"
            placeholder="Adresse e-mail"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            type="password"
            placeholder="Mot de passe initial"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            className="btn primary"
            disabled={
              busyId === 'create' ||
              !email.trim() ||
              password.length < 8
            }
            onClick={() => void createUser()}
          >
            Créer le compte
          </button>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <h2>Comptes</h2>
            <p>Rôles, suspension et suppression des utilisateurs.</p>
          </div>
        </div>

        {loading ? (
          <div className="admin-loading">
            Chargement de l’administration…
          </div>
        ) : (
          <div className="admin-users-table">
            <div className="admin-user-row admin-user-head">
              <span>Utilisateur</span>
              <span>Rôle</span>
              <span>Dernière connexion</span>
              <span>État</span>
              <span>Actions</span>
            </div>

            {users.map((user) => {
              const suspended = isSuspended(user)
              const busy = busyId === user.id

              return (
                <div className="admin-user-row" key={user.id}>
                  <div className="admin-user-identity">
                    <strong>{user.displayName || 'Sans nom'}</strong>
                    <span>{user.email ?? '—'}</span>
                  </div>

                  <span
                    className={
                      user.role === 'admin'
                        ? 'admin-role admin'
                        : 'admin-role'
                    }
                  >
                    {user.role === 'admin'
                      ? 'Administrateur'
                      : 'Utilisateur'}
                  </span>

                  <span className="admin-muted">
                    {formatDate(user.lastSignInAt)}
                  </span>

                  <span
                    className={
                      suspended
                        ? 'admin-status suspended'
                        : 'admin-status active'
                    }
                  >
                    {suspended ? 'Suspendu' : 'Actif'}
                  </span>

                  <div className="admin-row-actions">
                    <button
                      disabled={busy}
                      onClick={() =>
                        void inspectUserData(user)
                      }
                    >
                      <Eye size={15}/>
                      Données
                    </button>

                    <button
                      disabled={busy || user.isCurrentAdmin}
                      onClick={() =>
                        void runForUser(
                          user.id,
                          () =>
                            adminSetRole(
                              user.id,
                              user.role === 'admin'
                                ? 'user'
                                : 'admin',
                            ),
                          'Rôle mis à jour.',
                        )
                      }
                    >
                      <ShieldCheck size={15}/>
                      {user.role === 'admin'
                        ? 'Rétrograder'
                        : 'Admin'}
                    </button>

                    <button
                      disabled={busy || user.isCurrentAdmin}
                      onClick={() =>
                        void runForUser(
                          user.id,
                          () =>
                            adminSetSuspended(
                              user.id,
                              !suspended,
                            ),
                          suspended
                            ? 'Compte réactivé.'
                            : 'Compte suspendu.',
                        )
                      }
                    >
                      <Ban size={15}/>
                      {suspended ? 'Réactiver' : 'Suspendre'}
                    </button>

                    <button
                      className="admin-delete"
                      disabled={busy || user.isCurrentAdmin}
                      onClick={() => void deleteUser(user)}
                    >
                      <Trash2 size={15}/>
                      Supprimer
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {selectedDataUser && (
        <section className="admin-panel admin-user-data-panel">
          <div className="admin-panel-head">
            <div>
              <h2>
                Données de {selectedDataUser.displayName || selectedDataUser.email || 'l’utilisateur'}
              </h2>
              <p>
                Vue applicative contrôlée du compte. Les données sensibles d’authentification ne sont jamais exposées.
              </p>
            </div>
            <button
              className="icon-button"
              aria-label="Fermer l’aperçu"
              onClick={() => {
                setSelectedDataUser(null)
                setUserOverview(null)
              }}
            >
              ×
            </button>
          </div>

          {overviewLoading ? (
            <div className="admin-loading">
              Chargement des données…
            </div>
          ) : userOverview ? (
            <>
              <div className="admin-user-data-metrics">
                <div><span>Projets</span><strong>{userOverview.counts.projects}</strong></div>
                <div><span>Tâches</span><strong>{userOverview.counts.tasks}</strong></div>
                <div><span>À faire</span><strong>{userOverview.counts.openTasks}</strong></div>
                <div><span>Terminées</span><strong>{userOverview.counts.completedTasks}</strong></div>
                <div><span>Routines</span><strong>{userOverview.counts.routines}</strong></div>
                <div><span>Événements</span><strong>{userOverview.counts.calendarEvents}</strong></div>
                <div><span>Segments</span><strong>{userOverview.counts.plannedSegments}</strong></div>
              </div>

              <div className="admin-user-data-columns">
                <section>
                  <h3>Tâches récentes</h3>
                  {userOverview.recentTasks.length === 0 ? (
                    <p className="admin-muted">Aucune tâche.</p>
                  ) : (
                    <div className="admin-data-list">
                      {userOverview.recentTasks.map((task) => (
                        <article key={task.id}>
                          <div>
                            <strong>{task.title}</strong>
                            <span>
                              {task.category} · {task.priority} · {task.status}
                            </span>
                          </div>
                          <time>
                            {formatDate(task.updatedAt)}
                          </time>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <section>
                  <h3>Projets récents</h3>
                  {userOverview.recentProjects.length === 0 ? (
                    <p className="admin-muted">Aucun projet.</p>
                  ) : (
                    <div className="admin-data-list">
                      {userOverview.recentProjects.map((project) => (
                        <article key={project.id}>
                          <div>
                            <strong>{project.name}</strong>
                            <span>
                              {project.archived ? 'Archivé' : 'Actif'}
                            </span>
                          </div>
                          <time>
                            {formatDate(project.updatedAt)}
                          </time>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          ) : null}
        </section>
      )}

      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <h2>Base de données</h2>
            <p>
              Volumétrie des principales tables Horizon. Les opérations SQL brutes restent volontairement réservées au tableau de bord Supabase.
            </p>
          </div>
          <Database size={20}/>
        </div>

        <div className="admin-db-grid">
          <div><span>Profils</span><strong>{stats?.profiles ?? '—'}</strong></div>
          <div><span>Projets</span><strong>{stats?.projects ?? '—'}</strong></div>
          <div><span>Tâches</span><strong>{stats?.tasks ?? '—'}</strong></div>
          <div><span>Routines</span><strong>{stats?.routines ?? '—'}</strong></div>
          <div><span>Événements</span><strong>{stats?.calendarEvents ?? '—'}</strong></div>
          <div><span>Segments</span><strong>{stats?.plannedSegments ?? '—'}</strong></div>
        </div>
      </section>

      {notice && (
        <p className="admin-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="planning-error" role="alert">
          {error}
        </p>
      )}
    </main>
  )
}
