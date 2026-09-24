import { Bell, Search, Sun } from 'lucide-react'

export function Header({ view, onView }: { view: 'week' | 'now'; onView: (v: 'week' | 'now') => void }) {
  return (
    <header className="topbar">
      <div className="top-nav">
        <button className={view === 'now' ? 'top-link active' : 'top-link'} onClick={() => onView('now')}>Maintenant</button>
        <button className="top-link">Aujourd’hui</button>
        <button className={view === 'week' ? 'top-link active' : 'top-link'} onClick={() => onView('week')}>Semaine</button>
        <button className="top-link">Mois</button>
        <button className="top-link">Année</button>
      </div>
      <div className="search"><Search size={18}/><span>Rechercher une tâche, un projet…</span><kbd>⌘K</kbd></div>
      <button className="icon-button"><Sun size={20}/></button>
      <button className="icon-button"><Bell size={20}/><span className="notif-dot"/></button>
      <div className="top-avatar">R</div>
    </header>
  )
}
