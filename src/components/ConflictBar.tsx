import { AlertTriangle, ArrowRight, X } from 'lucide-react'
import { DAYS } from '../domain/constants'
import type { PlannerEvent } from '../domain/types'
import { formatTime } from '../utils/time'

interface Props {
  event: PlannerEvent
  conflicts: PlannerEvent[]
  suggestion: { day: number; startMin: number } | null
  onAccept: () => void
  onDismiss: () => void
  onUndo: () => void
}

export function ConflictBar({ event, conflicts, suggestion, onAccept, onDismiss, onUndo }: Props) {
  return (
    <aside className="conflict-bar">
      <div className="conflict-icon"><AlertTriangle size={18}/></div>
      <div className="conflict-copy">
        <strong>Conflit avec {conflicts.map((c) => `« ${c.title} »`).join(', ')}</strong>
        {suggestion ? <span>Horizon propose {DAYS[suggestion.day]} à {formatTime(suggestion.startMin)}.</span> : <span>Aucun créneau évident dans la fenêtre actuelle.</span>}
      </div>
      <div className="conflict-actions">
        <button onClick={onUndo}>Annuler le déplacement</button>
        {suggestion && <button className="accept" onClick={onAccept}>Déplacer <ArrowRight size={15}/></button>}
        <button className="close" onClick={onDismiss}><X size={17}/></button>
      </div>
    </aside>
  )
}
