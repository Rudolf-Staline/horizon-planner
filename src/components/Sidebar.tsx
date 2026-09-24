import { BarChart3, CalendarDays, CheckSquare2, FolderKanban, Repeat2, Target } from 'lucide-react'

const items = [
  ['Calendrier', CalendarDays],
  ['Tâches', CheckSquare2],
  ['Projets', FolderKanban],
  ['Routines', Repeat2],
  ['Focus', Target],
  ['Analyses', BarChart3],
] as const

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">Horizon</div>
      <nav className="sidebar-nav">
        {items.map(([label, Icon], index) => (
          <button className={`nav-item ${index === 0 ? 'active' : ''}`} key={label}>
            <Icon size={19} strokeWidth={2} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-user">
        <div className="avatar">R</div>
        <div><strong>Rudolf</strong><span>Avancer sereinement.</span></div>
      </div>
    </aside>
  )
}
