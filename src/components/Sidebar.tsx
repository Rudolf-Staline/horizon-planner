import { useEffect, useRef } from 'react'
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckSquare2,
  FolderKanban,
  Repeat2,
  ShieldCheck,
  Settings,
  Target,
  Wallet,
} from 'lucide-react'
import { Brand } from './Brand'

export type Section =
  | 'calendar'
  | 'tasks'
  | 'projects'
  | 'routines'
  | 'journal'
  | 'finances'
  | 'focus'
  | 'analytics'
  | 'settings'
  | 'admin'

const mainItems = [
  ['calendar', 'Calendrier', CalendarDays],
  ['tasks', 'Tâches', CheckSquare2],
  ['projects', 'Projets', FolderKanban],
  ['routines', 'Routines', Repeat2],
  ['finances', 'Finances', Wallet],
] as const

const secondaryItems = [
  ['journal', 'Journal', BookOpen],
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
  const mobileNavRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const nav = mobileNavRef.current
    if (!nav) return
    const current = nav.querySelector<HTMLElement>('[aria-current="page"]')
    const centerCurrent = () => {
      if (current && nav.clientWidth) {
        nav.scrollTo({
          left:
            current.offsetLeft - (nav.clientWidth - current.offsetWidth) / 2,
          behavior: 'auto',
        })
      }
    }
    centerCurrent()
    const observer = new ResizeObserver(centerCurrent)
    observer.observe(nav)
    return () => observer.disconnect()
  }, [active])
  const identity = displayName || email || 'Utilisateur'
  const initial = identity.trim().charAt(0).toUpperCase() || 'U'

  const renderItem = (
    value: Section,
    label: string,
    Icon: typeof CalendarDays,
  ) => (
    <button
      className={`nav-item ${active === value ? 'active' : ''}`}
      data-section={value}
      key={value}
      onClick={() => onNavigate(value)}
      aria-current={active === value ? 'page' : undefined}
    >
      <Icon size={19} strokeWidth={2} />
      <span>{label}</span>
    </button>
  )

  const mobileItems = [...mainItems, ...secondaryItems] as const

  return (
    <>
      <aside className="sidebar">
        <Brand className="brand" />

        <nav className="sidebar-nav" aria-label="Navigation principale">
          <span className="nav-group-label">ORGANISER</span>
          {mainItems.map(([value, label, Icon]) =>
            renderItem(value, label, Icon),
          )}

          <div className="sidebar-separator" />
          <span className="nav-group-label">PRENDRE DU RECUL</span>

          {secondaryItems.map(([value, label, Icon]) =>
            renderItem(value, label, Icon),
          )}

          {isAdmin && (
            <>
              <div className="sidebar-separator" />
              {renderItem('admin', 'Administration', ShieldCheck)}
            </>
          )}
        </nav>

        <div className="sidebar-user">
          <div className="avatar">{initial}</div>
          <div>
            <strong>{identity}</strong>
            <span>{isAdmin ? 'Administrateur' : 'Compte personnel'}</span>
          </div>
        </div>
      </aside>

      <nav
        ref={mobileNavRef}
        className="mobile-nav"
        aria-label="Navigation principale"
      >
        {mobileItems.map(([value, label, Icon]) => (
          <button
            data-section={value}
            key={value}
            aria-current={active === value ? 'page' : undefined}
            className={
              active === value ? 'mobile-nav-item active' : 'mobile-nav-item'
            }
            onClick={() => onNavigate(value)}
          >
            <Icon size={19} strokeWidth={2} />
            <span>{label}</span>
          </button>
        ))}

        {isAdmin && (
          <button
            aria-current={active === 'admin' ? 'page' : undefined}
            className={
              active === 'admin' ? 'mobile-nav-item active' : 'mobile-nav-item'
            }
            onClick={() => onNavigate('admin')}
          >
            <ShieldCheck size={19} strokeWidth={2} />
            <span>Admin</span>
          </button>
        )}
      </nav>
    </>
  )
}
