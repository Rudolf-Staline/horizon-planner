import {
  AlertTriangle,
  ArrowRight,
  X,
} from 'lucide-react'
import type {
  PlannerEvent,
} from '../domain/types'
import type {
  ReplanProposal,
} from '../domain/replanning'
import {
  eventDateLabel,
} from '../utils/date'
import {
  formatTime,
} from '../utils/time'

interface Props {
  event: PlannerEvent
  conflicts: PlannerEvent[]
  suggestion: ReplanProposal | null
  onAccept: () => void
  onDismiss: () => void
  onUndo: () => void
}

export function ConflictBar({
  event,
  conflicts,
  suggestion,
  onAccept,
  onDismiss,
  onUndo,
}: Props) {
  const destinationLabel =
    suggestion
      ? eventDateLabel({
          ...event,
          date: suggestion.date,
          day: suggestion.day,
        })
      : null

  return (
    <aside className="conflict-bar">
      <div className="conflict-icon">
        <AlertTriangle size={18}/>
      </div>

      <div className="conflict-copy">
        <strong>
          Conflit entre « {event.title} » et{' '}
          {conflicts
            .map(
              (item) =>
                `« ${item.title} »`,
            )
            .join(', ')}
        </strong>

        {suggestion ? (
          <span>
            Horizon propose de déplacer
            {' '}« {suggestion.eventTitle} »
            {' '}vers {destinationLabel}
            {' '}à{' '}
            {formatTime(
              suggestion.startMin,
            )}.
          </span>
        ) : (
          <span>
            Aucun déplacement simple ne
            résout ce conflit sans choisir
            arbitrairement à votre place.
          </span>
        )}
      </div>

      <div className="conflict-actions">
        <button onClick={onUndo}>
          Annuler la dernière modification
        </button>

        {suggestion && (
          <button
            className="accept"
            onClick={onAccept}
          >
            Appliquer
            <ArrowRight size={15}/>
          </button>
        )}

        <button
          className="close"
          onClick={onDismiss}
          aria-label="Fermer"
        >
          <X size={17}/>
        </button>
      </div>
    </aside>
  )
}
