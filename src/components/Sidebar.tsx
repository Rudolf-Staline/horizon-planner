import {
  BarChart3,
  CalendarDays,
  CheckSquare2,
  FolderKanban,
  Repeat2,
  Target,
} from 'lucide-react'

export type Section =
  | 'calendar'
  | 'tasks'
  | 'projects'
  | 'routines'
  | 'focus'
  | 'analytics'

const items = [
  ['calendar', 'Calendrier', CalendarDays],
  ['tasks', 'Tâches', CheckSquare2],
  ['projects', 'Projets', FolderKanban],
  ['routines', 'Routines', Repeat2],
  ['focus', 'Focus', Target],
  ['analytics', 'Analyses', BarChart3],
] as const

interface Props {
  active: Section
  onNavigate: (section: Section) => void
}

export function Sidebar({ active, onNavigate }: Props) {
  return (
    <aside className="sidebar">
      <div className="brand">Horizon</div>

      <nav className="sidebar-nav">
        {items.map(([value, label, Icon]) => (
          <button
            className={`nav-item ${active === value ? 'active' : ''}`}
            key={value}
            onClick={() => onNavigate(value)}
          >
            <Icon size={19} strokeWidth={2}/>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-user">
        <div className="avatar">R</div>
        <div>
          <strong>Rudolf</strong>
          <span>Avancer sereinement.</span>
        </div>
      </div>
    </aside>
  )
}
