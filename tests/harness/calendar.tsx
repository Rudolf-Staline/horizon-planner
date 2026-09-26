import {
  useState,
} from 'react'
import {
  createRoot,
} from 'react-dom/client'
import {
  CalendarView,
} from '../../src/components/CalendarView'
import {
  buildInlineTask,
  type InlineTaskDraft,
} from '../../src/domain/quickCreate'
import type {
  PlannerEvent,
} from '../../src/domain/types'
import '../../src/styles.css'

function CalendarHarness() {
  const [events, setEvents] =
    useState<PlannerEvent[]>([])
  const [draft, setDraft] =
    useState<InlineTaskDraft | null>(
      null,
    )
  const [
    selectedId,
    setSelectedId,
  ] = useState<string | null>(
    null,
  )

  return (
    <CalendarView
      mode="week"
      anchorDate="2026-09-21"
      events={events}
      selectedId={selectedId}
      draft={draft}
      onMode={() => {}}
      onAnchorDate={() => {}}
      onSelect={setSelectedId}
      onChange={(
        id,
        patch,
      ) =>
        setEvents(
          (current) =>
            current.map(
              (event) =>
                event.id === id
                  ? {
                      ...event,
                      ...patch,
                    }
                  : event,
            ),
        )
      }
      onEmptyClick={(
        date,
        day,
        startMin,
      ) =>
        setDraft({
          date,
          day,
          startMin,
        })
      }
      onDraftSubmit={(title) => {
        if (!draft) return

        const created =
          buildInlineTask(
            draft,
            title,
            'e2e-inline-task',
          )

        setEvents((current) => [
          ...current,
          created,
        ])
        setDraft(null)
      }}
      onDraftCancel={() =>
        setDraft(null)}
    />
  )
}

createRoot(
  document.getElementById(
    'root',
  )!,
).render(
  <CalendarHarness/>,
)
