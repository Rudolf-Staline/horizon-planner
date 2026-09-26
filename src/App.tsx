import { useEffect, useState } from 'react'
import { AccountDialog } from './components/AccountDialog'
import { AdminView } from './components/AdminView'
import { AnalyticsView } from './components/AnalyticsView'
import { AuthGate } from './components/AuthGate'
import { CollectionView } from './components/CollectionView'
import { CommandPalette } from './components/CommandPalette'
import { ConflictBar } from './components/ConflictBar'
import { Header } from './components/Header'
import { NowView } from './components/NowView'
import { QuickCreate } from './components/QuickCreate'
import { Sidebar, type Section } from './components/Sidebar'
import { TasksView } from './components/TasksView'
import { WeekCalendar } from './components/WeekCalendar'
import { usePlanner } from './state/planner'
import type { PlannerEvent } from './domain/types'

export default function App() {
  const planner = usePlanner()
  const [view, setView] = useState<'week' | 'now'>('week')
  const [section, setSection] = useState<Section>('calendar')
  const [quick, setQuick] = useState<{
    day: number
    startMin: number
  } | null>(null)
  const [commandOpen, setCommandOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  const isAdmin = planner.cloudUserRole === 'admin'
  const userLabel =
    planner.cloudDisplayName ||
    planner.cloudUserEmail

  useEffect(() => {
    if (!isAdmin && section === 'admin') {
      setSection('calendar')
    }
  }, [isAdmin, section])

  useEffect(() => {
    if (planner.authStatus !== 'authenticated') return

    const handle = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return

      if (event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen(true)
        return
      }

      if (event.key.toLowerCase() !== 'z') return

      event.preventDefault()
      if (event.shiftKey) planner.redo()
      else planner.undo()
    }

    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [planner.authStatus, planner.undo, planner.redo])

  const create = (created: PlannerEvent[]) => {
    if (planner.authStatus !== 'authenticated') return

    planner.createEvents(created)
    planner.setSelectedId(created[0]?.id ?? null)
    setQuick(null)
  }

  if (planner.authStatus !== 'authenticated') {
    return <AuthGate status={planner.authStatus}/>
  }

  return (
    <div className="app">
      <Header
        view={section === 'focus' ? 'now' : view}
        onView={(nextView) => {
          setView(nextView)
          setSection(nextView === 'now' ? 'focus' : 'calendar')
        }}
        onCommand={() => setCommandOpen(true)}
        onAccount={() => setAccountOpen(true)}
        cloudStatus={planner.cloudStatus}
        userLabel={userLabel}
      />

      <div className="app-body">
        <Sidebar
          active={section}
          isAdmin={isAdmin}
          displayName={planner.cloudDisplayName}
          email={planner.cloudUserEmail}
          onNavigate={(nextSection) => {
            setSection(nextSection)

            if (nextSection === 'focus') setView('now')
            if (nextSection === 'calendar') setView('week')
          }}
        />

        {section === 'calendar' && (
          <WeekCalendar
            events={planner.events}
            selectedId={planner.selectedId}
            onSelect={planner.setSelectedId}
            onChange={planner.updateEvent}
            onEmptyClick={(day, startMin) =>
              setQuick({ day, startMin })
            }
          />
        )}

        {section === 'tasks' && (
          <TasksView
            events={planner.events}
            onToggle={planner.toggleCompleted}
          />
        )}

        {section === 'projects' && (
          <CollectionView
            title="Projets"
            kicker="CONSTRUCTION"
            category="project"
            events={planner.events}
          />
        )}

        {section === 'routines' && (
          <CollectionView
            title="Routines"
            kicker="RÉPÉTITION"
            category="routine"
            events={planner.events}
          />
        )}

        {section === 'focus' && (
          <NowView events={planner.events}/>
        )}

        {section === 'analytics' && (
          <AnalyticsView events={planner.events}/>
        )}

        {section === 'admin' && isAdmin && (
          <AdminView/>
        )}
      </div>

      {accountOpen && (
        <AccountDialog
          cloudStatus={planner.cloudStatus}
          userId={planner.cloudUserId}
          userEmail={planner.cloudUserEmail}
          displayName={planner.cloudDisplayName}
          role={planner.cloudUserRole}
          onDisplayNameChange={planner.setCloudDisplayName}
          onClose={() => setAccountOpen(false)}
        />
      )}

      {commandOpen && (
        <CommandPalette
          events={planner.events}
          onClose={() => setCommandOpen(false)}
          onCreate={(created) => {
            create(created)
            setCommandOpen(false)
          }}
        />
      )}

      {quick && (
        <QuickCreate
          day={quick.day}
          startMin={quick.startMin}
          events={planner.events}
          onClose={() => setQuick(null)}
          onCreate={create}
        />
      )}

      {planner.conflictEvent &&
        planner.conflicts.length > 0 && (
          <ConflictBar
            event={planner.conflictEvent}
            conflicts={planner.conflicts}
            suggestion={planner.suggestion}
            onAccept={planner.acceptSuggestion}
            onDismiss={planner.dismissConflict}
            onUndo={planner.undo}
          />
        )}
    </div>
  )
}
