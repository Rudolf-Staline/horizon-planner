import { useMemo, useState } from 'react'
import { ArrowRight, Command, Sparkles, X } from 'lucide-react'
import { parseQuickTask } from '../domain/naturalLanguage'
import { START_MIN } from '../domain/constants'
import { planFlexibleTask, type SchedulingOptions } from '../domain/scheduling'
import type { PlannerEvent } from '../domain/types'
import {
  eventDateLabel,
  fromISODate,
  toISODate,
} from '../utils/date'
import {
  formatTime,
  nextSnapMinute,
} from '../utils/time'

interface Props {
  events: PlannerEvent[]
  contextDate: string
  onClose: () => void
  onCreate: (events: PlannerEvent[]) => void
  schedulingOptions?: SchedulingOptions
  defaultDurationMin?: number
}

export function CommandPalette({
  events,
  contextDate,
  onClose,
  onCreate,
  schedulingOptions,
  defaultDurationMin = 60,
}: Props) {
  const [value, setValue] = useState('')
  const [error, setError] =
    useState<string | null>(null)

  const context = fromISODate(contextDate)
  const now = new Date()
  const contextStartMin =
    toISODate(now) === contextDate
      ? nextSnapMinute(
          now.getHours() * 60 +
            now.getMinutes(),
        )
      : START_MIN

  const parsed = useMemo(
    () =>
      parseQuickTask(
        value,
        contextDate,
        contextStartMin,
        defaultDurationMin,
      ),
    [value, contextDate, contextStartMin, defaultDurationMin],
  )

  const draftPreview = useMemo(() => {
    if (!parsed) return null

    return {
      id: 'preview',
      ...parsed,
    } satisfies PlannerEvent
  }, [parsed, contextDate])

  const plan = useMemo(() => {
    if (
      !draftPreview ||
      draftPreview.kind !== 'flexible'
    ) {
      return null
    }

    return planFlexibleTask(
      draftPreview,
      events,
      schedulingOptions,
    )
  }, [draftPreview, events, schedulingOptions])

  const create = () => {
    if (!parsed) return

    const taskId = crypto.randomUUID()
    const draft: PlannerEvent = {
      id: taskId,
      entityType: 'task',
      taskId,
      segmentIndex: 0,
      segmentCount: 1,
      ...parsed,
    }

    if (draft.kind === 'fixed') {
      onCreate([draft])
      return
    }

    const resolved =
      planFlexibleTask(draft, events, schedulingOptions)

    if (!resolved) {
      setError(
        'Aucun créneau admissible. Reformule avec une fenêtre plus large ou une deadline plus tardive.',
      )
      return
    }

    const created =
      resolved.placements.map(
        (placement, index) => ({
          ...draft,
          id:
            resolved.kind === 'single'
              ? draft.id
              : crypto.randomUUID(),
          taskId,
          segmentIndex: index,
          segmentCount:
            resolved.placements.length,
          title: draft.title,
          date:
            placement.date ??
            draft.date,
          day: placement.day,
          startMin: placement.startMin,
          durationMin:
            placement.durationMin,
        }),
      )

    onCreate(created)
  }

  const previewPlacement =
    parsed?.kind === 'fixed'
      ? draftPreview
      : plan?.placements[0]

  const previewDate =
    previewPlacement?.date ??
    draftPreview?.date ??
    null

  return (
    <div
      className="command-overlay"
      onMouseDown={onClose}
    >
      <section
        className="command-palette"
        onMouseDown={(event) =>
          event.stopPropagation()}
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
          <button onClick={onClose}>
            <X size={17}/>
          </button>
        </div>

        {!parsed ? (
          <div className="command-empty">
            Écris naturellement ce que tu veux planifier.
          </div>
        ) : (
          <div className="command-preview">
            <div className="command-preview-main">
              <span className="command-kicker">
                {parsed.kind === 'fixed'
                  ? 'ÉVÉNEMENT FIXE'
                  : 'TÂCHE FLEXIBLE'}
              </span>
              <strong>{parsed.title}</strong>
              <span>
                {Math.floor(
                  parsed.durationMin / 60,
                ) > 0
                  ? `${Math.floor(
                      parsed.durationMin / 60,
                    )} h `
                  : ''}
                {parsed.durationMin % 60 ||
                parsed.durationMin < 60
                  ? `${parsed.durationMin % 60 || parsed.durationMin} min`
                  : ''}
              </span>
            </div>

            {previewPlacement ? (
              <div className="command-placement">
                <span>Proposition</span>
                <strong>
                  {eventDateLabel({
                    id: 'preview',
                    title: parsed.title,
                    date: previewDate ?? undefined,
                    day: previewPlacement.day,
                    startMin:
                      previewPlacement.startMin,
                    durationMin:
                      parsed.durationMin,
                    category:
                      parsed.category,
                    kind: parsed.kind,
                  })} · {formatTime(
                    previewPlacement.startMin,
                  )}
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

        {error && (
          <p className="planning-error">
            {error}
          </p>
        )}

        <div className="command-footer">
          <span>
            <Sparkles size={14}/>
            Planification locale et déterministe.
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
