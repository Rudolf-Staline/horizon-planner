import { Bell, Cloud, Search, Sun } from 'lucide-react'
import type { CloudStatus } from '../state/planner'

interface Props {
  view: 'week' | 'now'
  onView: (v: 'week' | 'now') => void
  onCommand: () => void
  onAccount: () => void
  cloudStatus: CloudStatus
  userLabel: string | null
}

export function Header({
  view,
  onView,
  onCommand,
  onAccount,
  cloudStatus,
  userLabel,
}: Props) {
  const initial =
    userLabel?.trim().charAt(0).toUpperCase() || 'U'

  return (
    <header className="topbar">
      <div className="top-nav">
        <button
          className={view === 'now' ? 'top-link active' : 'top-link'}
          onClick={() => onView('now')}
        >
          Maintenant
        </button>
        <button className="top-link">Aujourd’hui</button>
        <button
          className={view === 'week' ? 'top-link active' : 'top-link'}
          onClick={() => onView('week')}
        >
          Semaine
        </button>
        <button className="top-link">Mois</button>
        <button className="top-link">Année</button>
      </div>

      <button className="search" onClick={onCommand}>
        <Search size={18}/>
        <span>Planifier ou rechercher…</span>
        <kbd>⌘K</kbd>
      </button>

      <button
        className={`icon-button sync-indicator sync-${cloudStatus}`}
        title={
          cloudStatus === 'synced'
            ? 'Synchronisé'
            : cloudStatus === 'syncing'
              ? 'Synchronisation…'
              : cloudStatus === 'error'
                ? 'Erreur de synchronisation'
                : 'Mode local'
        }
        onClick={onAccount}
      >
        <Cloud size={19}/>
        <span className="sync-dot"/>
      </button>

      <button className="icon-button"><Sun size={20}/></button>
      <button className="icon-button">
        <Bell size={20}/>
        <span className="notif-dot"/>
      </button>
      <button
        className="top-avatar"
        onClick={onAccount}
        aria-label="Ouvrir mon compte"
      >
        {initial}
      </button>
    </header>
  )
}
