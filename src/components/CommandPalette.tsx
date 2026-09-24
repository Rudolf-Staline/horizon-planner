import { useMemo, useState } from 'react'
import { ArrowRight, Command, Sparkles, X } from 'lucide-react'
import { DAYS } from '../domain/constants'
import { parseQuickTask } from '../domain/naturalLanguage'
import { planFlexibleTask } from '../domain/scheduling'
import type { PlannerEvent } from '../domain/types'
import { formatTime } from '../utils/time'

interface Props {
  events: PlannerEvent[]
  onClose: () => void
  onCreate: (events: PlannerEvent[]) => void
}

export function CommandPalette({
  events,
  onClose,
  onCreate,
}: Props) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const parsed = useMemo(
    () => parseQuickTask(value, 2, 15 * 60),
    [value],
  )

  const plan = useMemo(() => {
    if (!parsed || parsed.kind !== 'flexible') return null

    const draft: PlannerEvent = {
      id: 'preview',
      ...parsed,
    }

    return planFlexibleTask(draft, events)
  }, [parsed, events])

  const create = () => {
    if (!parsed) return

    const draft: PlannerEvent = {
      id: crypto.randomUUID(),
      ...parsed,
    }

    if (draft.kind === 'fixed') {
      onCreate([draft])
      return
    }

    const resolved = planFlexibleTask(draft, events)
    if (!resolved) {
      setError(
        'Aucun créneau admissible. Reformule avec une fenêtre plus large ou une deadline plus tardive.'
      )
      return
    }

    const created = resolved.placements.map((placement, index) => ({
      ...draft,
      id: crypto.randomUUID(),
      title: resolved.kind === 'split'
        ? `${draft.title} · ${index + 1}/${resolved.placements.length}`
        : draft.title,
      day: placement.day,
      startMin: placement.startMin,
      durationMin: placement.durationMin,
    }))

    onCreate(created)
  }

  const previewPlacement =
    parsed?.kind === 'fixed'
      ? parsed
      : plan?.placements[0]

  return (
    <div className="command-overlay" onMouseDown={onClose}>
      <section
        className="command-palette"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="command-input-row">
          <Command size={20}/>
          <input
            autoFocus
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
              setError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose()
              if (event.key === 'Enter') create()
            }}
            placeholder="Ex. demain réviser EDP 1h30 après 14h"
          />
          <kbd>↵</kbd>
          <button onClick={onClose}><X size={17}/></button>
        </div>

        {!parsed ? (
          <div className="command-empty">
            Écris naturellement ce que tu veux planifier.
          </div>
        ) : (
          <div className="command-preview">
            <div className="command-preview-main">
              <span className="command-kicker">
                {parsed.kind === 'fixed' ? 'ÉVÉNEMENT FIXE' : 'TÂCHE FLEXIBLE'}
              </span>
              <strong>{parsed.title}</strong>
              <span>
                {Math.floor(parsed.durationMin / 60) > 0
                  ? `${Math.floor(parsed.durationMin / 60)} h `
                  : ''}
                {parsed.durationMin % 60 || parsed.durationMin < 60
                  ? `${parsed.durationMin % 60 || parsed.durationMin} min`
                  : ''}
              </span>
            </div>

            {previewPlacement ? (
              <div className="command-placement">
                <span>Proposition</span>
                <strong>
                  {DAYS[previewPlacement.day]} · {formatTime(previewPlacement.startMin)}
                </strong>
              </div>
            ) : (
              <div className="command-placement unavailable">
                <span>Planification</span>
                <strong>Aucun créneau</strong>
              </div>
            )}
          </div>
        )}

        {error && <p className="planning-error">{error}</p>}

        <div className="command-footer">
          <span>
            <Sparkles size={14}/>
            Déterministe pour l’instant — aucune donnée envoyée à un modèle.
          </span>

          <button
            className="command-create"
            disabled={!parsed}
            onClick={create}
          >
            Planifier
            <ArrowRight size={16}/>
          </button>
        </div>
      </section>
    </div>
  )
}
