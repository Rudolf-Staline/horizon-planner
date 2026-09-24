import { useEffect, useState } from 'react'
import { ConflictBar } from './components/ConflictBar'
import { Header } from './components/Header'
import { NowView } from './components/NowView'
import { QuickCreate } from './components/QuickCreate'
import { Sidebar } from './components/Sidebar'
import { WeekCalendar } from './components/WeekCalendar'
import { usePlanner } from './state/planner'
import type { PlannerEvent } from './domain/types'

export default function App() {
  const planner = usePlanner()
  const [view, setView] = useState<'week' | 'now'>('week')
  const [quick, setQuick] = useState<{ day: number; startMin: number } | null>(null)

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return
      if (event.key.toLowerCase() !== 'z') return
      event.preventDefault()
      if (event.shiftKey) planner.redo()
      else planner.undo()
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [planner.undo, planner.redo])

  const create = (event: PlannerEvent) => {
    planner.createEvent(event)
    planner.setSelectedId(event.id)
    setQuick(null)
  }

  return (
    <div className="app">
      <Header view={view} onView={setView}/>
      <div className="app-body">
        <Sidebar />
        {view === 'week' ? (
          <WeekCalendar
            events={planner.events}
            selectedId={planner.selectedId}
            onSelect={planner.setSelectedId}
            onChange={planner.updateEvent}
            onEmptyClick={(day, startMin) => setQuick({ day, startMin })}
          />
        ) : <NowView events={planner.events} />}
      </div>
      {quick && <QuickCreate day={quick.day} startMin={quick.startMin} onClose={() => setQuick(null)} onCreate={create}/>} 
      {planner.conflictEvent && planner.conflicts.length > 0 && (
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
