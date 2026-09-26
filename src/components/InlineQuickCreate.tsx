import {
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  PX_PER_MIN,
  START_MIN,
} from '../domain/constants'
import type {
  InlineTaskDraft,
} from '../domain/quickCreate'

interface Props {
  draft: InlineTaskDraft
  visibleDay: number
  columnWidth: number
  onSubmit: (title: string) => void
  onCancel: () => void
}

export function InlineQuickCreate({
  draft,
  visibleDay,
  columnWidth,
  onSubmit,
  onCancel,
}: Props) {
  const [title, setTitle] =
    useState('')
  const inputRef =
    useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const submit = () => {
    if (!title.trim()) return
    onSubmit(title)
  }

  return (
    <div
      className="inline-quick-create"
      style={{
        top:
          (draft.startMin -
            START_MIN) *
          PX_PER_MIN,
        left:
          visibleDay *
            columnWidth +
          4,
        width:
          columnWidth - 8,
      }}
      onClick={(event) =>
        event.stopPropagation()}
      onPointerDown={(event) =>
        event.stopPropagation()}
      role="group"
      aria-label="Création rapide"
    >
      <input
        ref={inputRef}
        value={title}
        placeholder="Nouvelle tâche"
        aria-label="Titre de la nouvelle tâche"
        onChange={(event) =>
          setTitle(
            event.target.value,
          )}
        onKeyDown={(event) => {
          if (
            event.key === 'Escape'
          ) {
            event.preventDefault()
            onCancel()
            return
          }

          if (
            event.key === 'Enter'
          ) {
            event.preventDefault()
            submit()
          }
        }}
      />
      <span>
        Entrée pour créer · Échap pour annuler
      </span>
    </div>
  )
}
