import { Fragment, useEffect, useRef, useState } from 'react'
import {
  Archive,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronLeft,
  Maximize2,
  Minimize2,
  Plus,
  RotateCcw,
  Save,
} from 'lucide-react'
import {
  journalRepository,
  type JournalDraft,
  type JournalEntry,
  type JournalRepository,
} from '../data/journal'
import { zonedDateToIso } from '../utils/timezone'

const moods = ['Très difficile', 'Difficile', 'Neutre', 'Bien', 'Très bien']
const mouths = [
  'M7 17 Q12 9 17 17',
  'M8 16 Q12 12 16 16',
  'M8 15 H16',
  'M8 14 Q12 18 16 14',
  'M7 13 Q12 22 17 13 Z',
]
function MoodMark({ value }: { value: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 9h.01M16 9h.01" strokeWidth="3" />
      <path d={mouths[value - 1]} />
    </svg>
  )
}
function blank(timeZone: string): JournalDraft {
  return {
    id: crypto.randomUUID(),
    entry_date: zonedDateToIso(new Date(), timeZone),
    title: '',
    content: '',
    mood: null,
    archived: false,
  }
}
function draftOf(entry: JournalEntry): JournalDraft {
  const { id, entry_date, title, content, mood, archived } = entry
  return { id, entry_date, title, content, mood, archived }
}
function dateLabel(date: string, monthOnly = false) {
  return new Intl.DateTimeFormat('fr-FR', {
    ...(monthOnly
      ? { month: 'long' as const, year: 'numeric' as const }
      : { dateStyle: 'long' as const }),
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`))
}

export function JournalView({
  userId,
  timeZone,
  active = true,
  repository = journalRepository,
}: {
  userId: string
  timeZone: string
  active?: boolean
  repository?: JournalRepository
}) {
  const [draft, setDraft] = useState(() => blank(timeZone))
  const [original, setOriginal] = useState<JournalEntry | null>(null)
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [archives, setArchives] = useState(false)
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [historyError, setHistoryError] = useState('')
  const [message, setMessage] = useState('')
  const [focused, setFocused] = useState(false)
  const [retry, setRetry] = useState(0)
  // Undefined means no dialog; null requests a new blank entry.
  const [pendingEntry, setPendingEntry] = useState<
    JournalEntry | null | undefined
  >()
  const generation = useRef(0)
  const formRef = useRef<HTMLFormElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const modeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const dirty = original
    ? JSON.stringify(draft) !== JSON.stringify(draftOf(original))
    : Boolean(draft.title || draft.content || draft.mood)
  const canSave =
    !saving &&
    !draft.archived &&
    Boolean(draft.content.trim()) &&
    (dirty || !original)
  const wordCount = draft.content.trim()
    ? draft.content.trim().split(/\s+/).length
    : 0

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  useEffect(() => {
    if (!active) return
    const key = (event: KeyboardEvent) => {
      if (pendingEntry !== undefined) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (canSave) formRef.current?.requestSubmit()
      }
      if (event.key === 'Escape' && focused) {
        setFocused(false)
        modeRef.current?.focus()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [active, canSave, focused, pendingEntry])
  useEffect(() => {
    if (focused && active) textRef.current?.focus({ preventScroll: true })
  }, [focused, active])
  useEffect(() => {
    const dialog = dialogRef.current
    if (pendingEntry !== undefined && active) dialog?.showModal()
    else dialog?.close()
    return () => dialog?.close()
  }, [pendingEntry, active])
  useEffect(() => {
    const request = ++generation.current
    if (!active) return
    setLoading(true)
    setHistoryError('')
    setEntries([])
    setMore(false)
    repository
      .list(userId, archives, 0)
      .then((rows) => {
        if (request === generation.current) {
          setEntries(rows)
          setMore(rows.length === 30)
        }
      })
      .catch(() => {
        if (request === generation.current)
          setHistoryError('Votre historique n’a pas pu être chargé.')
      })
      .finally(() => {
        if (request === generation.current) setLoading(false)
      })
    return () => {
      generation.current++
    }
  }, [userId, archives, repository, active, retry])

  function selectEntry(entry: JournalEntry | null) {
    setOriginal(entry)
    setDraft(entry ? draftOf(entry) : blank(timeZone))
    setError('')
    setMessage('')
  }
  function open(entry: JournalEntry | null) {
    if (saving || (entry && original?.id === entry.id)) return
    if (dirty) setPendingEntry(entry)
    else selectEntry(entry)
  }
  async function save(archived = draft.archived) {
    if (saving) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const saved = await repository.save(
        userId,
        { ...draft, archived },
        original,
      )
      setDraft(draftOf(saved))
      setOriginal(saved)
      setMessage(
        archived
          ? 'Entrée archivée.'
          : draft.archived
            ? 'Entrée restaurée.'
            : 'Entrée enregistrée.',
      )
      try {
        const request = ++generation.current
        setLoading(false)
        const rows = await repository.list(userId, archives, 0)
        if (request === generation.current) {
          setEntries(rows)
          setMore(rows.length === 30)
          setHistoryError('')
        }
      } catch {
        setHistoryError(
          'L’entrée est enregistrée. L’historique n’a pas pu être actualisé.',
        )
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Enregistrement impossible. Votre texte reste dans l’éditeur ; réessayez.',
      )
    } finally {
      setSaving(false)
    }
  }
  async function loadMore() {
    const request = generation.current
    setLoading(true)
    setHistoryError('')
    try {
      const rows = await repository.list(userId, archives, entries.length)
      if (request === generation.current) {
        setEntries((current) => [...current, ...rows])
        setMore(rows.length === 30)
      }
    } catch {
      if (request === generation.current)
        setHistoryError('La suite de l’historique n’a pas pu être chargée.')
    } finally {
      if (request === generation.current) setLoading(false)
    }
  }
  const patch = (value: Partial<JournalDraft>) => {
    setDraft((current) => ({ ...current, ...value }))
    setMessage('')
  }

  return (
    <main
      className={`collection-page journal-page ${focused ? 'is-focused' : ''}`}
      hidden={!active}
    >
      <header className="section-header journal-heading">
        <div>
          <span className="section-kicker">LE FIL DES JOURS</span>
          <h1>
            Mon journal<span aria-hidden="true">.</span>
          </h1>
          <p>Gardez une trace de ce qui compte pour vous.</p>
        </div>
        <div className="journal-heading-actions">
          <button
            ref={modeRef}
            className="journal-mode"
            aria-pressed={focused}
            aria-label={focused ? 'Quitter le mode écriture' : 'Mode écriture'}
            onClick={() => setFocused((current) => !current)}
          >
            {focused ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            <span>{focused ? 'Revenir au journal' : 'Mode écriture'}</span>
          </button>
          <button
            className="btn primary"
            onClick={() => open(null)}
            disabled={saving}
          >
            <Plus size={17} />
            <span>Nouvelle entrée</span>
          </button>
        </div>
      </header>
      <div className="journal-layout">
        <section
          className="journal-editor"
          aria-label="Écrire dans mon journal"
        >
          <div className="journal-editor-top">
            <span className="journal-folio">
              <BookOpen size={15} />
              {original ? 'Une page de votre histoire' : 'UNE NOUVELLE PAGE'}
            </span>
            <span
              className={`journal-status ${dirty ? 'is-dirty' : ''} ${draft.archived ? 'is-archived' : ''}`}
            >
              {saving ? (
                'Enregistrement…'
              ) : draft.archived ? (
                'Archivée'
              ) : dirty ? (
                'À enregistrer'
              ) : original ? (
                <>
                  <Check size={12} />
                  Enregistrée
                </>
              ) : (
                'Brouillon'
              )}
            </span>
          </div>
          <form
            ref={formRef}
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
          >
            <fieldset disabled={saving || draft.archived}>
              <div className="journal-meta">
                <label>
                  <span>Date de l’entrée</span>
                  <input
                    aria-label="Date de l’entrée"
                    type="date"
                    required
                    value={draft.entry_date}
                    onChange={(event) =>
                      patch({ entry_date: event.target.value })
                    }
                  />
                </label>
                <span className="journal-date-note">
                  Une journée à raconter
                </span>
              </div>
              <label className="journal-title">
                <span className="journal-sr-only">Titre (facultatif)</span>
                <input
                  maxLength={160}
                  value={draft.title}
                  onChange={(event) => patch({ title: event.target.value })}
                  placeholder="Donnez un titre à cette page…"
                />
              </label>
              <div className="journal-mood">
                <span id="mood-label">
                  Votre ressenti <span>(facultatif)</span>
                </span>
                <div role="group" aria-labelledby="mood-label">
                  {moods.map((mood, index) => (
                    <button
                      key={mood}
                      type="button"
                      aria-pressed={draft.mood === index + 1}
                      aria-label={mood}
                      onClick={() =>
                        patch({
                          mood: draft.mood === index + 1 ? null : index + 1,
                        })
                      }
                    >
                      <MoodMark value={index + 1} />
                      <span>{mood}</span>
                    </button>
                  ))}
                </div>
              </div>
              <label className="journal-writing">
                <span className="journal-sr-only">Votre texte</span>
                <textarea
                  ref={textRef}
                  required
                  maxLength={100000}
                  value={draft.content}
                  onChange={(event) => patch({ content: event.target.value })}
                  placeholder="Commencez par ce qui vous vient. Un détail, une idée, un moment de la journée…"
                  rows={10}
                />
              </label>
            </fieldset>
            <div className="journal-editor-footer">
              <div className="journal-word-count">
                <strong>{wordCount.toLocaleString('fr-FR')}</strong>
                <span>{wordCount === 1 ? 'mot' : 'mots'}</span>
              </div>
              <div className="journal-save">
                <span className="journal-save-hint">
                  Enregistrement manuel <kbd>⌘ / Ctrl S</kbd>
                </span>
                <button className="btn primary" disabled={!canSave}>
                  <Save size={16} />
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </form>
          <div className="journal-editor-bottom">
            <p className="journal-feedback" role="status">
              {message ||
                (dirty
                  ? 'Votre page contient des modifications à enregistrer.'
                  : '')}
            </p>
            {original && (
              <button
                className="journal-archive"
                disabled={saving || dirty}
                title={
                  dirty
                    ? 'Enregistrez les modifications avant d’archiver.'
                    : undefined
                }
                onClick={() => void save(!draft.archived)}
              >
                {draft.archived ? (
                  <RotateCcw size={14} />
                ) : (
                  <Archive size={14} />
                )}
                <span>
                  {draft.archived
                    ? 'Restaurer cette entrée'
                    : 'Archiver cette entrée'}
                </span>
              </button>
            )}
          </div>
          {error && (
            <div className="journal-error" role="alert">
              <strong>Votre texte est conservé dans l’éditeur.</strong>
              <p>{error}</p>
            </div>
          )}
        </section>
        <aside
          className="journal-history"
          aria-label="Historique du journal"
          hidden={focused}
        >
          <div className="journal-history-heading">
            <span className="section-kicker">AU FIL DU TEMPS</span>
            <h2>Vos pages</h2>
          </div>
          <div
            className="journal-tabs"
            role="group"
            aria-label="Afficher les entrées"
          >
            <button
              disabled={saving || loading}
              aria-pressed={!archives}
              onClick={() => setArchives(false)}
            >
              Journal
            </button>
            <button
              disabled={saving || loading}
              aria-pressed={archives}
              onClick={() => setArchives(true)}
            >
              Archives
            </button>
          </div>
          {historyError && (
            <div className="journal-history-error" role="alert">
              <p>{historyError}</p>
              <button
                disabled={saving || loading}
                onClick={() => setRetry((current) => current + 1)}
              >
                <RotateCcw size={14} />
                Réessayer
              </button>
            </div>
          )}
          {!entries.length && !loading && !historyError && (
            <div className="journal-empty">
              <BookOpen size={26} />
              <h3>
                {archives
                  ? 'Des pages à retrouver'
                  : 'La première page est la vôtre.'}
              </h3>
              <p>
                {archives
                  ? 'Aucune entrée archivée pour l’instant. Vous pourrez les relire et les restaurer ici.'
                  : 'Un souvenir, une question, une pensée. Quelques mots suffisent pour commencer.'}
              </p>
            </div>
          )}
          <div className="journal-entry-list">
            {entries.map((entry, index) => (
              <Fragment key={entry.id}>
                {(index === 0 ||
                  entries[index - 1].entry_date.slice(0, 7) !==
                    entry.entry_date.slice(0, 7)) && (
                  <h3 className="journal-month">
                    {dateLabel(entry.entry_date, true)}
                  </h3>
                )}
                <button
                  className={`journal-entry ${original?.id === entry.id ? 'selected' : ''}`}
                  onClick={() => open(entry)}
                  disabled={saving}
                  aria-pressed={original?.id === entry.id}
                >
                  <div className="journal-entry-date">
                    <time dateTime={entry.entry_date}>
                      {dateLabel(entry.entry_date)}
                    </time>
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </div>
                  <strong>{entry.title || 'Sans titre'}</strong>
                  <p>{entry.content.slice(0, 160)}</p>
                  {entry.mood && (
                    <span className="journal-entry-mood">
                      <MoodMark value={entry.mood} />
                      {moods[entry.mood - 1]}
                    </span>
                  )}
                </button>
              </Fragment>
            ))}
          </div>
          {loading && (
            <p className="journal-loading" role="status">
              <span aria-hidden="true" />
              Chargement de vos pages…
            </p>
          )}
          {more && (
            <button
              className="journal-more"
              disabled={loading || saving}
              onClick={() => void loadMore()}
            >
              Voir les entrées précédentes
              <ChevronLeft size={14} />
            </button>
          )}
          <p className="journal-history-note">Une page à la fois.</p>
        </aside>
      </div>
      <dialog
        ref={dialogRef}
        className="journal-discard-dialog"
        aria-labelledby="journal-discard-title"
        onCancel={(event) => {
          event.preventDefault()
          setPendingEntry(undefined)
        }}
      >
        <span className="section-kicker">VOTRE BROUILLON</span>
        <h2 id="journal-discard-title">Garder le fil ?</h2>
        <p>
          Cette page contient des modifications non enregistrées. Vous pouvez
          continuer à écrire ou les abandonner pour ouvrir une autre page.
        </p>
        <div>
          <button
            autoFocus
            className="btn secondary"
            onClick={() => setPendingEntry(undefined)}
          >
            Continuer à écrire
          </button>
          <button
            className="btn primary"
            onClick={() => {
              if (pendingEntry !== undefined) selectEntry(pendingEntry)
              setPendingEntry(undefined)
            }}
          >
            Abandonner les modifications
          </button>
        </div>
      </dialog>
    </main>
  )
}
