import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { JournalView } from '../../src/components/JournalView'
import { Header } from '../../src/components/Header'
import { Sidebar, type Section } from '../../src/components/Sidebar'
import type { JournalEntry, JournalRepository } from '../../src/data/journal'
import '../../src/styles.css'
import '../../src/styles/interface.css'
import '../../src/styles/journal.css'
let entries: JournalEntry[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    title: 'Retrouver mon rythme',
    content:
      'Aujourd’hui, j’ai pris le temps de poser mes idées avant de commencer. Une petite avancée sur mon projet, puis une marche pour profiter de la fin de journée. Je retiens ce moment de calme.',
    entry_date: '2026-10-01',
    mood: 4,
    archived: false,
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-01T10:00:00Z',
  },
]
entries.push(
  {
    ...entries[0],
    id: '00000000-0000-4000-8000-000000000002',
    title: 'Un projet prend forme',
    content:
      'J’ai enfin trouvé comment aborder la prochaine étape. Mettre mes idées sur papier m’a aidé à voir ce qui était encore flou.',
    entry_date: '2026-09-30',
    mood: 5,
  },
  {
    ...entries[0],
    id: '00000000-0000-4000-8000-000000000003',
    title: 'Ralentir un peu',
    content:
      'Une journée moins chargée. J’ai laissé de la place à une conversation et à quelques pages de lecture.',
    entry_date: '2026-09-28',
    mood: 3,
  },
)
let fail = new URLSearchParams(location.search).has('fail')
let historyFail = new URLSearchParams(location.search).has('historyFail')
const repository: JournalRepository = {
  async list(_userId, archived, offset) {
    if (historyFail) {
      historyFail = false
      throw new Error('History unavailable')
    }
    return entries
      .filter((e) => e.archived === archived)
      .sort((a, b) => b.entry_date.localeCompare(a.entry_date))
      .slice(offset, offset + 30)
  },
  async save(_userId, draft) {
    if (fail) {
      fail = false
      throw new Error('Connexion interrompue. Réessayez.')
    }
    const saved = {
      ...draft,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    entries = [...entries.filter((e) => e.id !== draft.id), saved]
    return saved
  },
}
function Harness() {
  const [section, setSection] = useState<Section>('journal')
  return (
    <div className="app">
      <Header
        section={section}
        view="week"
        onView={() => {}}
        onCommand={() => {}}
        onAccount={() => {}}
        cloudStatus="synced"
        userLabel="Démonstration"
      />
      <div className="app-body">
        <Sidebar
          active={section}
          onNavigate={setSection}
          isAdmin={false}
          displayName="Démonstration"
          email={null}
        />
        <JournalView
          userId="demo"
          timeZone="Africa/Casablanca"
          active={section === 'journal'}
          repository={repository}
        />
        {section !== 'journal' && (
          <main className="collection-page">
            <h1>Calendrier de démonstration</h1>
          </main>
        )}
      </div>
    </div>
  )
}
createRoot(document.getElementById('root')!).render(<Harness />)
