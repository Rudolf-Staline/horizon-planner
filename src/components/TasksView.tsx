import { useMemo, useState } from 'react'
import { Check, Circle, Filter, Search } from 'lucide-react'
import { CATEGORY_LABEL } from '../domain/constants'
import type { PlannerEvent } from '../domain/types'
import { eventDateLabel } from '../utils/date'
import { formatTime } from '../utils/time'

type FilterMode = 'open' | 'all' | 'completed'

interface Props {
  events: PlannerEvent[]
  onToggle: (id: string) => void
  onSelect: (id: string) => void
  onCreate: () => void
}

export function TasksView({
  events,
  onToggle,
  onSelect,
  onCreate,
}: Props) {
  const [filter, setFilter] = useState<FilterMode>('open')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    return [...events]
      .filter((event) => {
        if (filter === 'open' && event.completed) return false
        if (filter === 'completed' && !event.completed) return false
        if (
          normalized &&
          !event.title.toLowerCase().includes(normalized)
        ) {
          return false
        }
        return true
      })
      .sort((a, b) =>
        (a.date ?? '').localeCompare(b.date ?? '') ||
        a.startMin - b.startMin ||
        a.title.localeCompare(b.title)
      )
  }, [events, filter, query])

  const openCount = events.filter((event) => !event.completed).length

  return (
    <main className="tasks-page">
      <header className="section-header">
        <div>
          <span className="section-kicker">EXÉCUTION</span>
          <h1>Tâches</h1>
          <p>{openCount} éléments encore ouverts cette semaine.</p>
        </div>

        <div className="tasks-header-actions">
          <button
            className="btn primary"
            onClick={onCreate}
          >
            Nouvelle tâche
          </button>
          <div className="tasks-search">
          <Search size={17}/>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher…"
          />
          </div>
        </div>
      </header>

      <div className="tasks-toolbar">
        <Filter size={15}/>
        {([
          ['open', 'À faire'],
          ['all', 'Toutes'],
          ['completed', 'Terminées'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            className={filter === value ? 'active' : ''}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="task-list">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <Check size={24}/>
            <strong>Rien ici.</strong>
            <span>Le planning est à jour pour ce filtre.</span>
          </div>
        ) : filtered.map((event) => (
          <article
            key={event.id}
            className={`task-row ${event.completed ? 'completed' : ''}`}
            onClick={() => onSelect(event.id)}
          >
            <button
              className="task-check"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation()
                onToggle(event.id)
              }}
              aria-label={
                event.completed
                  ? 'Marquer comme non terminée'
                  : 'Marquer comme terminée'
              }
            >
              {event.completed
                ? <Check size={15}/>
                : <Circle size={15}/>
              }
            </button>

            <div className="task-main">
              <strong>{event.title}</strong>
              <span>
                {eventDateLabel(event)} · {formatTime(event.startMin)} · {event.durationMin} min
              </span>
            </div>

            <span className={`task-category category-text-${event.category}`}>
              {CATEGORY_LABEL[event.category]}
            </span>

            <span className={`task-kind kind-${event.kind}`}>
              {event.kind === 'fixed' ? 'Fixe' : 'Flexible'}
            </span>
          </article>
        ))}
      </section>
    </main>
  )
}
