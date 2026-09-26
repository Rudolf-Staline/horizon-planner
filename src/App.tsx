import { useEffect, useMemo, useState } from 'react'
import { AccountDialog } from './components/AccountDialog'
import { AdminView } from './components/AdminView'
import { AnalyticsView } from './components/AnalyticsView'
import { AuthGate } from './components/AuthGate'
import {
  CalendarView,
  type CalendarMode,
} from './components/CalendarView'
import { RoutinesView } from './components/RoutinesView'
import { ProjectsView } from './components/ProjectsView'
import { CommandPalette } from './components/CommandPalette'
import { ConflictBar } from './components/ConflictBar'
import { Header } from './components/Header'
import { NowView } from './components/NowView'
import { QuickCreate } from './components/QuickCreate'
import { Sidebar, type Section } from './components/Sidebar'
import { TasksView } from './components/TasksView'
import { TaskDetailPanel } from './components/TaskDetailPanel'
import { usePlanner } from './state/planner'
import type { PlannerEvent } from './domain/types'
import {
  fromISODate,
  monthGridDates,
  startOfWeek,
  toISODate,
} from './utils/date'
import {
  expandRoutines,
  listRoutines,
  type Routine,
} from './data/routines'

export default function App() {
  const planner = usePlanner()
  const [view, setView] =
    useState<CalendarMode | 'now'>('week')
  const [anchorDate, setAnchorDate] =
    useState(() => toISODate(new Date()))
  const [section, setSection] =
    useState<Section>('calendar')
  const [quick, setQuick] = useState<{
    date: string
    day: number
    startMin: number
  } | null>(null)
  const [commandOpen, setCommandOpen] =
    useState(false)
  const [accountOpen, setAccountOpen] =
    useState(false)
  const [routines, setRoutines] =
    useState<Routine[]>([])

  const isAdmin =
    planner.cloudUserRole === 'admin'
  const userLabel =
    planner.cloudDisplayName ||
    planner.cloudUserEmail

  useEffect(() => {
    if (!planner.cloudUserId) {
      setRoutines([])
      return
    }

    void listRoutines(planner.cloudUserId)
      .then(setRoutines)
      .catch(() => setRoutines([]))
  }, [planner.cloudUserId])

  useEffect(() => {
    if (!isAdmin && section === 'admin') {
      setSection('calendar')
    }
  }, [isAdmin, section])

  useEffect(() => {
    if (
      planner.authStatus !==
      'authenticated'
    ) {
      return
    }

    const handle = (
      event: KeyboardEvent,
    ) => {
      if (
        !(
          event.metaKey ||
          event.ctrlKey
        )
      ) {
        return
      }

      if (
        event.key.toLowerCase() === 'k'
      ) {
        event.preventDefault()
        setCommandOpen(true)
        return
      }

      if (
        event.key.toLowerCase() !== 'z'
      ) {
        return
      }

      event.preventDefault()
      if (event.shiftKey) planner.redo()
      else planner.undo()
    }

    window.addEventListener(
      'keydown',
      handle,
    )

    return () =>
      window.removeEventListener(
        'keydown',
        handle,
      )
  }, [
    planner.authStatus,
    planner.undo,
    planner.redo,
  ])

  const routineEvents = useMemo(() => {
    const anchor = fromISODate(anchorDate)

    let rangeStart = anchor
    let rangeEnd = anchor

    if (view === 'week') {
      rangeStart = startOfWeek(anchor)
      rangeEnd = new Date(rangeStart)
      rangeEnd.setDate(
        rangeEnd.getDate() + 6,
      )
    } else if (view === 'month') {
      const dates = monthGridDates(anchor)
      rangeStart = dates[0]
      rangeEnd =
        dates[dates.length - 1]
    } else if (view === 'year') {
      rangeStart = new Date(
        anchor.getFullYear(),
        0,
        1,
        12,
      )
      rangeEnd = new Date(
        anchor.getFullYear(),
        11,
        31,
        12,
      )
    } else if (view === 'now') {
      rangeStart = new Date()
      rangeEnd = new Date()
    }

    return expandRoutines(
      routines,
      toISODate(rangeStart),
      toISODate(rangeEnd),
    )
  }, [routines, anchorDate, view])

  const calendarEvents = useMemo(
    () => [
      ...planner.events,
      ...routineEvents,
    ],
    [planner.events, routineEvents],
  )

  const create = (
    created: PlannerEvent[],
  ) => {
    if (
      planner.authStatus !==
      'authenticated'
    ) {
      return
    }

    planner.createEvents(created)
    planner.setSelectedId(
      created[0]?.id ?? null,
    )
    setQuick(null)
  }

  if (
    planner.authStatus !==
    'authenticated'
  ) {
    return (
      <AuthGate
        status={planner.authStatus}
      />
    )
  }

  return (
    <div className="app">
      <Header
        view={
          section === 'focus'
            ? 'now'
            : view
        }
        onView={(nextView) => {
          setView(nextView)
          setSection(
            nextView === 'now'
              ? 'focus'
              : 'calendar',
          )
        }}
        onCommand={() =>
          setCommandOpen(true)
        }
        onAccount={() =>
          setAccountOpen(true)
        }
        cloudStatus={
          planner.cloudStatus
        }
        userLabel={userLabel}
      />

      <div className="app-body">
        <Sidebar
          active={section}
          isAdmin={isAdmin}
          displayName={
            planner.cloudDisplayName
          }
          email={
            planner.cloudUserEmail
          }
          onNavigate={(
            nextSection,
          ) => {
            setSection(nextSection)

            if (
              nextSection === 'focus'
            ) {
              setView('now')
            }

            if (
              nextSection ===
              'calendar'
            ) {
              if (view === 'now') {
                setView('week')
              }
            }
          }}
        />

        {section === 'calendar' &&
          view !== 'now' && (
            <CalendarView
              mode={view}
              anchorDate={anchorDate}
              events={calendarEvents}
              selectedId={
                planner.selectedId
              }
              onMode={setView}
              onAnchorDate={
                setAnchorDate
              }
              onSelect={
                planner.setSelectedId
              }
              onChange={
                planner.updateEvent
              }
              onEmptyClick={(
                date,
                day,
                startMin,
              ) =>
                setQuick({
                  date,
                  day,
                  startMin,
                })
              }
            />
          )}

        {section === 'tasks' && (
          <TasksView
            events={planner.events}
            onToggle={planner.toggleCompleted}
            onSelect={planner.setSelectedId}
            onCreate={() => setCommandOpen(true)}
          />
        )}

        {section === 'projects' &&
          planner.cloudUserId && (
            <ProjectsView
              userId={planner.cloudUserId}
              events={planner.events}
            />
          )}

        {section === 'routines' &&
          planner.cloudUserId && (
            <RoutinesView
              userId={planner.cloudUserId}
              routines={routines}
              onChange={setRoutines}
            />
          )}

        {section === 'focus' && (
          <NowView
            events={calendarEvents}
            onComplete={
              planner.toggleCompleted
            }
          />
        )}

        {section === 'analytics' && (
          <AnalyticsView
            events={planner.events}
          />
        )}

        {section === 'admin' &&
          isAdmin && <AdminView/>}
      </div>

      {accountOpen && (
        <AccountDialog
          cloudStatus={
            planner.cloudStatus
          }
          userId={
            planner.cloudUserId
          }
          userEmail={
            planner.cloudUserEmail
          }
          displayName={
            planner.cloudDisplayName
          }
          role={
            planner.cloudUserRole
          }
          onDisplayNameChange={
            planner.setCloudDisplayName
          }
          onClose={() =>
            setAccountOpen(false)
          }
        />
      )}

      {commandOpen && (
        <CommandPalette
          events={planner.events}
          contextDate={anchorDate}
          onClose={() =>
            setCommandOpen(false)
          }
          onCreate={(created) => {
            create(created)
            setCommandOpen(false)
          }}
        />
      )}

      {quick && (
        <QuickCreate
          date={quick.date}
          day={quick.day}
          startMin={quick.startMin}
          events={planner.events}
          onClose={() =>
            setQuick(null)
          }
          onCreate={create}
        />
      )}

      {planner.selected && (
        <TaskDetailPanel
          event={planner.selected}
          userId={planner.cloudUserId!}
          onClose={() => planner.setSelectedId(null)}
          onChange={planner.editEvent}
          onDelete={planner.deleteEvent}
          onToggleCompleted={planner.toggleCompleted}
        />
      )}

      {planner.conflictEvent &&
        planner.conflicts.length >
          0 && (
          <ConflictBar
            event={
              planner.conflictEvent
            }
            conflicts={
              planner.conflicts
            }
            suggestion={
              planner.suggestion
            }
            onAccept={
              planner.acceptSuggestion
            }
            onDismiss={
              planner.dismissConflict
            }
            onUndo={planner.undo}
          />
        )}
    </div>
  )
}
