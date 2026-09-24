import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { Category, PlannerEvent } from '../domain/types'

interface Props {
  day: number
  startMin: number
  onClose: () => void
  onCreate: (event: PlannerEvent) => void
}

export function QuickCreate({ day, startMin, onClose, onCreate }: Props) {
  const [title, setTitle] = useState('')
  const [duration, setDuration] = useState(60)
  const [category, setCategory] = useState<Category>('course')
  const [kind, setKind] = useState<'fixed' | 'flexible'>('flexible')
  const canCreate = useMemo(() => title.trim().length > 1, [title])

  const submit = () => {
    if (!canCreate) return
    onCreate({
      id: crypto.randomUUID(),
      title: title.trim(),
      day,
      startMin,
      durationMin: duration,
      category,
      kind,
      windowStartMin: kind === 'flexible' ? Math.max(7 * 60, startMin - 60) : undefined,
      windowEndMin: kind === 'flexible' ? Math.min(22 * 60, startMin + 180) : undefined,
    })
  }

  return (
    <div className="quick-overlay" onMouseDown={onClose}>
      <section className="quick-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="panel-head"><div><h2>Nouvelle tâche</h2><p>Créer d’abord. Affiner seulement si nécessaire.</p></div><button className="icon-button" onClick={onClose}><X size={19}/></button></div>
        <input autoFocus className="field" placeholder="Nom de la tâche" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit() }} />
        <div className="field-grid">
          <label><span>Durée</span><select value={duration} onChange={(e) => setDuration(Number(e.target.value))}><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>1 h</option><option value={90}>1 h 30</option><option value={120}>2 h</option></select></label>
          <label><span>Type</span><select value={kind} onChange={(e) => setKind(e.target.value as 'fixed' | 'flexible')}><option value="flexible">Flexible</option><option value="fixed">Fixe</option></select></label>
          <label><span>Catégorie</span><select value={category} onChange={(e) => setCategory(e.target.value as Category)}><option value="course">Cours</option><option value="project">Projet</option><option value="focus">Focus</option><option value="routine">Routine</option><option value="personal">Personnel</option><option value="admin">Administratif</option></select></label>
        </div>
        <button className="advanced-link">Options avancées ↓</button>
        <div className="panel-actions"><button className="btn secondary" onClick={onClose}>Annuler</button><button className="btn primary" disabled={!canCreate} onClick={submit}>Créer</button></div>
      </section>
    </div>
  )
}
