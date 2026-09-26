import {
  BarChart3,
  CalendarDays,
  CheckSquare2,
  FolderKanban,
  Repeat2,
  ShieldCheck,
  Settings,
  Target,
} from 'lucide-react'

export type Section =
  | 'calendar'
  | 'tasks'
  | 'projects'
  | 'routines'
  | 'focus'
  | 'analytics'
  | 'settings'
  | 'admin'

const mainItems = [
  ['calendar', 'Calendrier', CalendarDays],
  ['tasks', 'Tâches', CheckSquare2],
  ['projects', 'Projets', FolderKanban],
  ['routines', 'Routines', Repeat2],
] as const

const secondaryItems = [
  ['focus', 'Focus', Target],
  ['analytics', 'Analyses', BarChart3],
  ['settings', 'Paramètres', Settings],
] as const

interface Props {
  active: Section
  onNavigate: (section: Section) => void
  isAdmin: boolean
  displayName: string | null
  email: string | null
}

export function Sidebar({
  active,
  onNavigate,
  isAdmin,
  displayName,
  email,
}: Props) {
  const identity = displayName || email || 'Utilisateur'
  const initial = identity.trim().charAt(0).toUpperCase() || 'U'

  const renderItem = (
    value: Section,
    label: string,
    Icon: typeof CalendarDays,
  ) => (
    <button
      className={`nav-item ${active === value ? 'active' : ''}`}
      key={value}
      onClick={() => onNavigate(value)}
    >
      <Icon size={19} strokeWidth={2}/>
      <span>{label}</span>
    </button>
  )

  const mobileItems = [
    ...mainItems,
    ...secondaryItems,
  ] as const

  return (
    <>
    <aside className="sidebar">
      <div className="brand">Horizon</div>

      <nav className="sidebar-nav">
        {mainItems.map(([value, label, Icon]) =>
          renderItem(value, label, Icon)
        )}

        <div className="sidebar-separator"/>

        {secondaryItems.map(([value, label, Icon]) =>
          renderItem(value, label, Icon)
        )}

        {isAdmin && (
          <>
            <div className="sidebar-separator"/>
            {renderItem(
              'admin',
              'Administration',
              ShieldCheck,
            )}
          </>
        )}
      </nav>

      <div className="sidebar-user">
        <div className="avatar">{initial}</div>
        <div>
          <strong>{identity}</strong>
          <span>
            {isAdmin ? 'Administrateur' : 'Compte personnel'}
          </span>
        </div>
      </div>
    </aside>

    <nav
      className="mobile-nav"
      aria-label="Navigation principale"
    >
      {mobileItems.map(
        ([value, label, Icon]) => (
          <button
            key={value}
            className={
              active === value
                ? 'mobile-nav-item active'
                : 'mobile-nav-item'
            }
            onClick={() =>
              onNavigate(value)}
          >
            <Icon
              size={19}
              strokeWidth={2}
            />
            <span>{label}</span>
          </button>
        ),
      )}

      {isAdmin && (
        <button
          className={
            active === 'admin'
              ? 'mobile-nav-item active'
              : 'mobile-nav-item'
          }
          onClick={() =>
            onNavigate('admin')}
        >
          <ShieldCheck
            size={19}
            strokeWidth={2}
          />
          <span>Admin</span>
        </button>
      )}
    </nav>
    </>
  )
}
