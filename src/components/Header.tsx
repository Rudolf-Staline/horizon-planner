import { Bell, Search, Sun } from 'lucide-react'

interface Props {
  view: 'week' | 'now'
  onView: (v: 'week' | 'now') => void
  onCommand: () => void
}

export function Header({ view, onView, onCommand }: Props) {
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

      <button className="icon-button"><Sun size={20}/></button>
      <button className="icon-button">
        <Bell size={20}/>
        <span className="notif-dot"/>
      </button>
      <div className="top-avatar">R</div>
    </header>
  )
}
