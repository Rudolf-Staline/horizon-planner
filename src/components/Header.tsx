import { Cloud, Search, Target } from 'lucide-react'
import type { CloudStatus } from '../state/planner'
import type { CalendarMode } from './CalendarView'
import type { Section } from './Sidebar'
import { Brand } from './Brand'

const sectionLabels: Record<Section, string> = {
  calendar: 'Calendrier', tasks: 'Tâches', projects: 'Projets',
  routines: 'Routines', focus: 'Focus', analytics: 'Analyses',
  settings: 'Paramètres', admin: 'Administration',
}

interface Props {
  view: CalendarMode | 'now'
  section: Section
  onView: (view: CalendarMode | 'now') => void
  onCommand: () => void
  onAccount: () => void
  cloudStatus: CloudStatus
  userLabel: string | null
}

export function Header({
  view,
  section,
  onView,
  onCommand,
  onAccount,
  cloudStatus,
  userLabel,
}: Props) {
  const initial =
    userLabel?.trim().charAt(0).toUpperCase() || 'U'
  const syncLabel = cloudStatus === 'synced' ? 'Synchronisé'
    : cloudStatus === 'syncing' ? 'Synchronisation…'
      : cloudStatus === 'error' ? 'Erreur de synchronisation' : 'Mode local'

  return (
    <header className="topbar">
      <div className="topbar-context">
        <span>ESPACE PERSONNEL</span>
        <strong>{sectionLabels[section]}</strong>
        {section === 'calendar' && view !== 'now' && (
          <button className="topbar-focus" onClick={() => onView('now')}>
            <Target size={15}/> Maintenant
          </button>
        )}
      </div>

      <button
        className="search"
        onClick={onCommand}
      >
        <Search size={18}/>
        <span>Planifier ou rechercher…</span>
        <kbd>Ctrl / ⌘ K</kbd>
      </button>

      <div className="mobile-header-start">
        <Brand/>
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
        title={syncLabel}
        aria-label={`${syncLabel} · Ouvrir mon compte`}
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
