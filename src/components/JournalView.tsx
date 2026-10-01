import { useEffect, useRef, useState } from 'react'
import { Archive, BookOpen, Plus, Save } from 'lucide-react'
import {
  journalRepository,
  type JournalDraft,
  type JournalEntry,
  type JournalRepository,
} from '../data/journal'
import { zonedDateToIso } from '../utils/timezone'

const moods = ['Très difficile', 'Difficile', 'Neutre', 'Bien', 'Très bien']
const faces = ['😞', '🙁', '😐', '🙂', '😊']
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
function formatDate(date: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
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
  const [message, setMessage] = useState('')
  const generation = useRef(0)
  const dirty = original
    ? JSON.stringify(draft) !== JSON.stringify(draftOf(original))
    : Boolean(draft.title || draft.content || draft.mood)
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
    const request = ++generation.current
    if (!active) return
    setLoading(true)
    setError('')
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
          setError(
            'L’historique ne peut pas être chargé. Réessayez en ouvrant à nouveau le journal.',
          )
      })
      .finally(() => {
        if (request === generation.current) setLoading(false)
      })
    return () => {
      generation.current++
    }
  }, [userId, archives, repository, active])
  function open(entry: JournalEntry | null) {
    if (
      saving ||
      (dirty &&
        !window.confirm('Abandonner les modifications non enregistrées ?'))
    )
      return
    setOriginal(entry)
    setDraft(entry ? draftOf(entry) : blank(timeZone))
    setError('')
    setMessage('')
  }
  async function save(archived = draft.archived) {
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
      // Reset pagination after an edit that changes the ordering or archive state.
      try {
        const request = ++generation.current
        setLoading(false)
        const rows = await repository.list(userId, archives, 0)
        if (request === generation.current) {
          setEntries(rows)
          setMore(rows.length === 30)
        }
      } catch {
        setError(
          'L’entrée est enregistrée, mais l’historique n’a pas pu être actualisé. Rouvrez le journal pour réessayer.',
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
    setError('')
    try {
      const rows = await repository.list(userId, archives, entries.length)
      if (request === generation.current) {
        setEntries((current) => [...current, ...rows])
        setMore(rows.length === 30)
      }
    } catch {
      if (request === generation.current)
        setError('Impossible de charger la suite de l’historique. Réessayez.')
    } finally {
      if (request === generation.current) setLoading(false)
    }
  }
  const patch = (value: Partial<JournalDraft>) => {
    setDraft((current) => ({ ...current, ...value }))
    setMessage('')
  }
  return (
    <main className="collection-page journal-page" hidden={!active}>
      <header className="section-header">
        <div>
          <span className="section-kicker">PRENDRE DU RECUL</span>
          <h1>Mon journal</h1>
          <p>
            Un espace pour raconter vos journées, poser vos idées et garder une
            trace.
          </p>
        </div>
        <button
          className="btn primary"
          onClick={() => open(null)}
          disabled={saving}
        >
          <Plus size={17} /> Nouvelle entrée
        </button>
      </header>
      <div className="journal-layout">
        <section
          className="journal-editor"
          aria-label="Écrire dans mon journal"
        >
          <div className="journal-editor-top">
            <span>
              <BookOpen size={18} />{' '}
              {original ? 'Votre entrée' : 'Une page pour vous'}
            </span>
            <span className="journal-status">
              {dirty
                ? 'À enregistrer'
                : original
                  ? 'Enregistrée'
                  : 'Nouvelle entrée'}
            </span>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
          >
            <fieldset disabled={saving || draft.archived}>
              <label>
                Date de l’entrée
                <input
                  aria-label="Date de l’entrée"
                  type="date"
                  required
                  value={draft.entry_date}
                  onChange={(e) => patch({ entry_date: e.target.value })}
                />
              </label>
              <label>
                <span>
                  Titre <span className="muted">(facultatif)</span>
                </span>
                <input
                  maxLength={160}
                  value={draft.title}
                  onChange={(e) => patch({ title: e.target.value })}
                  placeholder="Quelques mots pour cette journée…"
                />
              </label>
              <div className="journal-mood">
                <span id="mood-label">
                  Comment vous sentez-vous ?{' '}
                  <span className="muted">(facultatif)</span>
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
                      <span aria-hidden="true">{faces[index]}</span>
                      <span>{mood}</span>
                    </button>
                  ))}
                </div>
              </div>
              <label className="journal-writing">
                Votre texte
                <textarea
                  required
                  maxLength={100000}
                  value={draft.content}
                  onChange={(e) => patch({ content: e.target.value })}
                  placeholder="Ce qui m’a marqué aujourd’hui… Une idée, un progrès, une difficulté, un moment à retenir."
                  rows={13}
                />
              </label>
            </fieldset>
            <div className="journal-editor-footer">
              <span className="muted">
                {draft.content.trim()
                  ? draft.content.trim().split(/\s+/).length
                  : 0}{' '}
                mots
              </span>
              <button
                className="btn primary"
                disabled={
                  saving ||
                  draft.archived ||
                  !draft.content.trim() ||
                  (!dirty && !!original)
                }
              >
                <Save size={16} />
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
          {original && (
            <button
              className="journal-archive"
              disabled={saving || dirty}
              onClick={() => void save(!draft.archived)}
            >
              <Archive size={15} />
              {draft.archived
                ? 'Restaurer cette entrée'
                : 'Archiver cette entrée'}
            </button>
          )}
          <p className="journal-feedback" role="status">
            {message}
          </p>
          {error && (
            <p className="journal-error" role="alert">
              {error}
            </p>
          )}
        </section>
        <aside className="journal-history" aria-label="Historique du journal">
          <div className="journal-history-heading">
            <h2>Vos pages</h2>
            <span>À votre rythme</span>
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
          {!entries.length && !loading && (
            <div className="journal-empty">
              <BookOpen size={28} />
              <h3>
                {archives
                  ? 'Aucune entrée archivée'
                  : 'Votre histoire commence ici'}
              </h3>
              <p>
                {archives
                  ? 'Les entrées archivées restent consultables et peuvent être restaurées.'
                  : 'Quelques mots suffisent. Écrivez votre première page, puis enregistrez-la.'}
              </p>
            </div>
          )}
          <div className="journal-entry-list">
            {entries.map((entry) => (
              <button
                className={`journal-entry ${original?.id === entry.id ? 'selected' : ''}`}
                key={entry.id}
                onClick={() => open(entry)}
                disabled={saving}
                aria-pressed={original?.id === entry.id}
              >
                <time dateTime={entry.entry_date}>
                  {formatDate(entry.entry_date)}
                </time>
                <strong>{entry.title || 'Sans titre'}</strong>
                <p>{entry.content.slice(0, 160)}</p>
                {entry.mood && (
                  <span>
                    {faces[entry.mood - 1]} {moods[entry.mood - 1]}
                  </span>
                )}
              </button>
            ))}
          </div>
          {loading && <p role="status">Chargement…</p>}
          {more && (
            <button
              className="btn secondary"
              disabled={loading || saving}
              onClick={() => void loadMore()}
            >
              Voir les entrées précédentes
            </button>
          )}
        </aside>
      </div>
    </main>
  )
}
