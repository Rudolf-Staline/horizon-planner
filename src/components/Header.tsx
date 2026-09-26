import { Cloud, Search } from 'lucide-react'
import type { CloudStatus } from '../state/planner'
import type { CalendarMode } from './CalendarView'

interface Props {
  view: CalendarMode | 'now'
  onView: (view: CalendarMode | 'now') => void
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
          className={
            view === 'now'
              ? 'top-link active'
              : 'top-link'
          }
          onClick={() => onView('now')}
        >
          Maintenant
        </button>

        {([
          ['day', 'Jour'],
          ['week', 'Semaine'],
          ['month', 'Mois'],
          ['year', 'Année'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            className={
              view === value
                ? 'top-link active'
                : 'top-link'
            }
            onClick={() => onView(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <button
        className="search"
        onClick={onCommand}
      >
        <Search size={18}/>
        <span>Planifier ou rechercher…</span>
        <kbd>⌘K</kbd>
      </button>

      <div className="mobile-header-start">
        <strong>Horizon</strong>
        <button
          className="mobile-command"
          onClick={onCommand}
          aria-label="Planifier ou rechercher"
        >
          <Search size={18}/>
        </button>
      </div>

      <button
        className={
          `icon-button sync-indicator sync-${cloudStatus}`
        }
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
