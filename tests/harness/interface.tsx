import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Header } from '../../src/components/Header'
import { Sidebar, type Section } from '../../src/components/Sidebar'
import { CalendarView, type CalendarMode } from '../../src/components/CalendarView'
import { TasksView } from '../../src/components/TasksView'
import { NowView } from '../../src/components/NowView'
import { AnalyticsView } from '../../src/components/AnalyticsView'
import { SettingsView } from '../../src/components/SettingsView'
import { BatchQuickCreate } from '../../src/components/BatchQuickCreate'
import { DEFAULT_PLANNER_PREFERENCES } from '../../src/domain/preferences'
import type { PlannerEvent } from '../../src/domain/types'
import '../../src/styles.css'
import '../../src/styles/interface.css'

// Synthetic, isolated data: this harness never connects to an account.
const sampleEvents: PlannerEvent[] = [
  { id: 'course', date: '2026-10-01', day: 3, startMin: 510, durationMin: 105, title: 'Modélisation et simulation', category: 'course', kind: 'fixed', locked: true },
  { id: 'project', date: '2026-09-29', day: 1, startMin: 840, durationMin: 120, title: 'Avancer sur le projet scientifique', category: 'project', kind: 'flexible', locked: false },
  { id: 'focus', date: '2026-10-02', day: 4, startMin: 630, durationMin: 90, title: 'Réviser les éléments finis', category: 'focus', kind: 'flexible', locked: false },
  { id: 'personal', date: '2026-09-30', day: 2, startMin: 960, durationMin: 60, title: 'Un moment pour soi', category: 'personal', kind: 'fixed', locked: false },
]
function InterfaceHarness() {
  const [section, setSection] = useState<Section>('calendar')
  const [mode, setMode] = useState<CalendarMode>(window.innerWidth <= 900 ? 'day' : 'week')
  const [date, setDate] = useState('2026-10-01')
  const [events, setEvents] = useState(sampleEvents)
  const [batch, setBatch] = useState(false)
  return <div className="app">
    <Header section={section} view={section === 'focus' ? 'now' : mode} onView={next => { if (next === 'now') setSection('focus'); else { setMode(next); setSection('calendar') } }} onCommand={() => {}} onAccount={() => {}} cloudStatus="synced" userLabel="Utilisateur de démonstration"/>
    <div className="app-body">
      <Sidebar active={section} onNavigate={next => setSection(next)} isAdmin={false} displayName="Utilisateur de démonstration avec un nom long" email={null}/>
      {section === 'calendar' && <CalendarView mode={mode} anchorDate={date} events={events} selectedId={null} draft={null} onMode={setMode} onBatchCreate={() => setBatch(true)} onAnchorDate={setDate} onSelect={() => {}} onChange={() => {}} onEmptyClick={() => {}} onDraftSubmit={() => {}} onDraftCancel={() => {}}/>}
      {section === 'tasks' && <TasksView userId="00000000-0000-4000-8000-000000000001" events={events} onToggleTask={() => {}} onSelect={() => {}} onCreateScheduled={event => setEvents(current => [...current, event])} defaultDurationMin={60} todayDate="2026-10-01" currentMinutes={480}/>}
      {section === 'focus' && <NowView events={events} onCompleteSegment={() => {}} onCompleteTask={() => {}} timeZone="Africa/Casablanca"/>}
      {section === 'analytics' && <AnalyticsView events={events} anchorDate={date}/>}
      {section === 'settings' && <SettingsView userId="00000000-0000-4000-8000-000000000001" preferences={DEFAULT_PLANNER_PREFERENCES} events={events} onSaved={() => {}} onImportEvents={() => {}} onOpenAccount={() => {}} onExternalEventsRemoved={() => {}}/>}
      {(section === 'projects' || section === 'routines') && <main className="collection-page"><header className="section-header"><div><span className="section-kicker">APERÇU VISUEL</span><h1>{section === 'projects' ? 'Projets' : 'Routines'}</h1></div></header></main>}
    </div>
    {batch && <BatchQuickCreate anchorDate={date} onClose={() => setBatch(false)} onCreate={() => setBatch(false)}/>}
  </div>
}
createRoot(document.getElementById('root')!).render(<InterfaceHarness/> )
