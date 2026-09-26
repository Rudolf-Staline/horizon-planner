import { CATEGORY_LABEL } from '../domain/constants'
import type { Category, PlannerEvent } from '../domain/types'
import { eventDateLabel } from '../utils/date'
import { formatTime } from '../utils/time'

interface Props {
  title: string
  kicker: string
  category: Category
  events: PlannerEvent[]
}

export function CollectionView({
  title,
  kicker,
  category,
  events,
}: Props) {
  const items = events
    .filter((event) => event.category === category)
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.startMin - b.startMin)

  return (
    <main className="collection-page">
      <header className="section-header">
        <div>
          <span className="section-kicker">{kicker}</span>
          <h1>{title}</h1>
          <p>
            Éléments planifiés dans cette catégorie.
          </p>
        </div>
      </header>

      <section className="collection-grid">
        {items.length === 0 ? (
          <div className="empty-state">
            <strong>Aucun élément.</strong>
          </div>
        ) : items.map((event) => (
          <article
            className={`collection-card category-${category}`}
            key={event.id}
          >
            <span>{CATEGORY_LABEL[category]}</span>
            <strong>{event.title}</strong>
            <small>
              {eventDateLabel(event)} · {formatTime(event.startMin)} · {event.durationMin} min
            </small>
          </article>
        ))}
      </section>
    </main>
  )
}
