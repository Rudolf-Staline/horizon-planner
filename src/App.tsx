import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { CalendarMode } from './components/CalendarView'
import { ConflictBar } from './components/ConflictBar'
import { Header } from './components/Header'
import { Sidebar, type Section } from './components/Sidebar'
import { usePlanner } from './state/planner'
import type { PlannerEvent } from './domain/types'
import { buildInlineTask } from './domain/quickCreate'
import {
  fromISODate,
  monthGridDates,
  startOfWeek,
  toISODate,
  weekDates,
} from './utils/date'
import {
  localDateTimeToIso,
  zonedDateMinutes,
  zonedDateToIso,
} from './utils/timezone'
import {
  groupTaskEvents,
  isReadOnlyCalendarEvent,
} from './domain/taskIdentity'
import { taskOverdueState } from './domain/overdue'
import {
  expandRoutines,
  listRoutineExceptions,
  listRoutines,
  type Routine,
  type RoutineException,
} from './data/routines'

const AdminView = lazy(() => import('./components/AdminView').then((module) => ({ default: module.AdminView })))
const AuthGate = lazy(() => import('./components/AuthGate').then((module) => ({ default: module.AuthGate })))
const AccountDialog = lazy(() => import('./components/AccountDialog').then((module) => ({ default: module.AccountDialog })))
const CalendarView = lazy(() => import('./components/CalendarView').then((module) => ({ default: module.CalendarView })))
const CommandPalette = lazy(() => import('./components/CommandPalette').then((module) => ({ default: module.CommandPalette })))
const TaskDetailPanel = lazy(() => import('./components/TaskDetailPanel').then((module) => ({ default: module.TaskDetailPanel })))
const AnalyticsView = lazy(() => import('./components/AnalyticsView').then((module) => ({ default: module.AnalyticsView })))
const RoutinesView = lazy(() => import('./components/RoutinesView').then((module) => ({ default: module.RoutinesView })))
const ProjectsView = lazy(() => import('./components/ProjectsView').then((module) => ({ default: module.ProjectsView })))
const NowView = lazy(() => import('./components/NowView').then((module) => ({ default: module.NowView })))
const TasksView = lazy(() => import('./components/TasksView').then((module) => ({ default: module.TasksView })))
const SettingsView = lazy(() => import('./components/SettingsView').then((module) => ({ default: module.SettingsView })))

function preferredCalendarMode(): CalendarMode {
  return window.matchMedia?.('(max-width: 900px)').matches
    ? 'day'
    : 'week'
}

export default function App() {
  const planner = usePlanner()
  const [view, setView] =
    useState<CalendarMode | 'now'>(
      () => preferredCalendarMode(),
    )
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
  const [routineExceptions, setRoutineExceptions] =
    useState<RoutineException[]>([])

  const isAdmin =
    planner.cloudUserRole === 'admin'
  const userLabel =
    planner.cloudDisplayName ||
    planner.cloudUserEmail

  useEffect(() => {
    if (planner.authStatus === 'authenticated') {
      setAnchorDate(
        zonedDateToIso(
          new Date(),
          planner.cloudPreferences.timezone,
        ),
      )
    }
  }, [
    planner.authStatus,
    planner.cloudUserId,
    planner.cloudPreferences.timezone,
  ])

  useEffect(() => {
    if (!planner.cloudUserId) {
      setRoutines([])
      setRoutineExceptions([])
      return
    }

    void Promise.all([
      listRoutines(planner.cloudUserId),
      listRoutineExceptions(planner.cloudUserId),
    ])
      .then(([nextRoutines, nextExceptions]) => {
        setRoutines(nextRoutines)
        setRoutineExceptions(nextExceptions)
      })
      .catch(() => {
        setRoutines([])
        setRoutineExceptions([])
      })
  }, [planner.cloudUserId])

  useEffect(() => {
    if (
      planner.authStatus !== 'authenticated' ||
      !planner.cloudPreferences.notificationsEnabled ||
      typeof Notification === 'undefined' ||
      Notification.permission !== 'granted'
    ) return

    const checkReminders = () => {
      const now = Date.now()
      const lead = planner.cloudPreferences.reminderLeadMin * 60_000
      const todayDate = zonedDateToIso(
        new Date(now),
        planner.cloudPreferences.timezone,
      )
      const overdueTasks = [
        ...groupTaskEvents(planner.events).values(),
      ]
        .map((segments) =>
          taskOverdueState(segments, todayDate),
        )
        .filter((state) => state !== null)
      const overdueKey =
        `horizon-overdue:${planner.cloudUserId}:${todayDate}`

      if (
        overdueTasks.length > 0 &&
        !sessionStorage.getItem(overdueKey)
      ) {
        const remainingMinutes = overdueTasks.reduce(
          (total, task) =>
            total + task.remainingMinutes,
          0,
        )
        new Notification(
          `Horizon · ${overdueTasks.length} tâche${overdueTasks.length > 1 ? 's' : ''} en retard`,
          {
            body: `${remainingMinutes} min restent à replanifier.`,
          },
        )
        sessionStorage.setItem(overdueKey, '1')
      }

      for (const event of planner.events) {
        if (event.virtual || !event.date) continue
        const startMs = new Date(
          localDateTimeToIso(
            event.date,
            event.startMin,
            planner.cloudPreferences.timezone,
          ),
        ).getTime()
        if (startMs < now || startMs - now > lead + 30_000) continue
        const key = `horizon-reminder:${planner.cloudUserId}:${event.id}:${event.date}:${event.startMin}`
        if (sessionStorage.getItem(key)) continue
        new Notification(`Horizon · ${event.title}`, { body: `Commence dans ${planner.cloudPreferences.reminderLeadMin} min.` })
        sessionStorage.setItem(key, '1')
      }
    }

    checkReminders()
    const timer = window.setInterval(checkReminders, 30_000)
    return () => window.clearInterval(timer)
  }, [planner.authStatus, planner.cloudPreferences, planner.cloudUserId, planner.events])

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
      rangeStart = startOfWeek(
        anchor,
        planner.cloudPreferences.weekStartsOn,
      )
      rangeEnd = new Date(rangeStart)
      rangeEnd.setDate(
        rangeEnd.getDate() + 6,
      )
    } else if (view === 'month') {
      const dates = monthGridDates(
        anchor,
        planner.cloudPreferences.weekStartsOn,
      )
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
      rangeStart = fromISODate(
        zonedDateToIso(
          new Date(),
          planner.cloudPreferences.timezone,
        ),
      )
      rangeEnd = rangeStart
    }

    return expandRoutines(
      routines,
      toISODate(rangeStart),
      toISODate(rangeEnd),
      routineExceptions,
    )
  }, [
    routines,
    routineExceptions,
    anchorDate,
    view,
    planner.cloudPreferences.timezone,
    planner.cloudPreferences.weekStartsOn,
  ])

  const calendarEvents = useMemo(
    () => [
      ...planner.events,
      ...routineEvents,
    ],
    [planner.events, routineEvents],
  )

  const analyticsRoutineEvents =
    useMemo(() => {
      const dates = weekDates(
        fromISODate(
          zonedDateToIso(
            new Date(),
            planner.cloudPreferences.timezone,
          ),
        ),
        planner.cloudPreferences.weekStartsOn,
      )

      return expandRoutines(
        routines,
        toISODate(dates[0]),
        toISODate(
          dates[
            dates.length - 1
          ],
        ),
        routineExceptions,
      )
    }, [
      routines,
      routineExceptions,
      planner.cloudPreferences.timezone,
      planner.cloudPreferences.weekStartsOn,
    ])

  const analyticsEvents =
    useMemo(
      () => [
        ...planner.events,
        ...analyticsRoutineEvents,
      ],
      [
        planner.events,
        analyticsRoutineEvents,
      ],
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
      <Suspense fallback={<main className="auth-gate auth-loading" role="status">Vérification de votre session…</main>}>
        <AuthGate status={planner.authStatus}/>
      </Suspense>
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
                setView(
                  preferredCalendarMode(),
                )
              }
            }
          }}
        />

        <Suspense fallback={<main className="section-loading" role="status">Chargement du calendrier…</main>}>
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
              onSelect={(id) => {
                if (
                  routineEvents.some(
                    (event) => event.id === id,
                  )
                ) {
                  planner.setSelectedId(null)
                  setSection('routines')
                  return
                }

                planner.setSelectedId(id)
              }}
              onChange={
                planner.updateEvent
              }
              draft={quick}
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
              onDraftCancel={() =>
                setQuick(null)
              }
              onDraftSubmit={(title) => {
                if (!quick) return
                create([
                  buildInlineTask(
                    quick,
                    title,
                    crypto.randomUUID(),
                    planner.cloudPreferences.defaultDurationMin,
                  ),
                ])
              }}
              weekStartsOn={planner.cloudPreferences.weekStartsOn}
              workdayStartMin={planner.cloudPreferences.workdayStartMin}
              workdayEndMin={planner.cloudPreferences.workdayEndMin}
              planningStepMin={planner.cloudPreferences.planningStepMin}
              timeZone={planner.cloudPreferences.timezone}
            />
          )}
        </Suspense>

        <Suspense fallback={<main className="section-loading" role="status">Chargement…</main>}>
        {section === 'tasks' && (
          planner.cloudUserId && (
            <TasksView
              userId={planner.cloudUserId}
              events={planner.events}
              defaultDurationMin={planner.cloudPreferences.defaultDurationMin}
              todayDate={zonedDateToIso(new Date(), planner.cloudPreferences.timezone)}
              currentMinutes={zonedDateMinutes(new Date(), planner.cloudPreferences.timezone)}
              onToggleTask={planner.toggleTaskCompleted}
              onSelect={planner.setSelectedId}
              onCreateScheduled={(event) => {
                planner.createEvent(event)
                planner.setSelectedId(event.id)
                if (event.date) {
                  setAnchorDate(event.date)
                }
              }}
            />
          )
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
              exceptions={routineExceptions}
              onChange={setRoutines}
              onExceptionsChange={setRoutineExceptions}
            />
          )}

        {section === 'focus' && (
          <NowView
            events={calendarEvents}
            timeZone={planner.cloudPreferences.timezone}
            onCompleteSegment={
              planner.toggleCompleted
            }
            onCompleteTask={
              planner.toggleTaskCompleted
            }
          />
        )}

        {section === 'analytics' && (
          <AnalyticsView
            events={analyticsEvents}
            weekStartsOn={planner.cloudPreferences.weekStartsOn}
            anchorDate={zonedDateToIso(new Date(), planner.cloudPreferences.timezone)}
          />
        )}

        {section === 'settings' && planner.cloudUserId && (
          <SettingsView
            userId={planner.cloudUserId}
            preferences={planner.cloudPreferences}
            events={planner.events}
            onSaved={planner.setCloudPreferences}
            onOpenAccount={() => setAccountOpen(true)}
            onExternalEventsRemoved={planner.removeExternalEvents}
          />
        )}

        {section === 'admin' &&
          isAdmin && <AdminView/>}
        </Suspense>
      </div>

      <Suspense fallback={null}>
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
          schedulingOptions={{
            startMin: planner.cloudPreferences.workdayStartMin,
            endMin: planner.cloudPreferences.workdayEndMin,
            activeDays: planner.cloudPreferences.activeDays,
            bufferMin: planner.cloudPreferences.bufferMin,
            planningStepMin: planner.cloudPreferences.planningStepMin,
            focusBlockMin: planner.cloudPreferences.focusBlockMin,
            energyPreference: planner.cloudPreferences.energyPreference,
          }}
          timeZone={planner.cloudPreferences.timezone}
          defaultDurationMin={planner.cloudPreferences.defaultDurationMin}
          onClose={() =>
            setCommandOpen(false)
          }
          onCreate={(created) => {
            create(created)
            setCommandOpen(false)
          }}
        />
      )}

      {planner.selected && (
        <TaskDetailPanel
          event={planner.selected}
          segments={planner.selectedTaskSegments}
          userId={planner.cloudUserId!}
          onClose={() => planner.setSelectedId(null)}
          onChange={planner.editEvent}
          onDuplicate={planner.duplicateTask}
          onDeleteSegment={planner.deleteEvent}
          onDeleteTask={planner.deleteTask}
          onToggleSegment={planner.toggleCompleted}
          onToggleTask={planner.toggleTaskCompleted}
          todayDate={zonedDateToIso(
            new Date(),
            planner.cloudPreferences.timezone,
          )}
          onReplan={planner.replanOverdueTask}
          readOnly={isReadOnlyCalendarEvent(planner.selected)}
        />
      )}
      </Suspense>

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
