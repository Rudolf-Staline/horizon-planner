import { supabase } from '../lib/supabase'

export interface JournalDraft {
  id: string
  entry_date: string
  title: string
  content: string
  mood: number | null
  archived: boolean
}
export interface JournalEntry extends JournalDraft {
  created_at: string
  updated_at: string
}
export const journalColumns =
  'id,entry_date,title,content,mood,archived,created_at,updated_at'
export function validateJournal(draft: JournalDraft) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.entry_date) ||
    Number.isNaN(Date.parse(draft.entry_date)) ||
    new Date(draft.entry_date).toISOString().slice(0, 10) !== draft.entry_date
  )
    throw new Error('Choisissez une date valide.')
  if (!draft.content.trim())
    throw new Error('Écrivez quelques mots avant d’enregistrer.')
  if (draft.content.length > 100000 || draft.title.length > 160)
    throw new Error(
      'Le texte est trop long (100 000 caractères, titre de 160 caractères).',
    )
  if (
    draft.mood !== null &&
    (!Number.isInteger(draft.mood) || draft.mood < 1 || draft.mood > 5)
  )
    throw new Error('Ce ressenti n’est pas valide.')
}
function client() {
  if (!supabase) throw new Error('Supabase n’est pas configuré.')
  return supabase
}
export const journalRepository = {
  async list(
    userId: string,
    archived: boolean,
    offset: number,
  ): Promise<JournalEntry[]> {
    const { data, error } = await client()
      .from('journal_entries')
      .select(journalColumns)
      .eq('user_id', userId)
      .eq('archived', archived)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id')
      .range(offset, offset + 29)
    if (error) throw error
    return data ?? []
  },
  async save(
    userId: string,
    draft: JournalDraft,
    original: JournalEntry | null,
  ): Promise<JournalEntry> {
    validateJournal(draft)
    const payload = { ...draft, user_id: userId }
    const query = original
      ? client()
          .from('journal_entries')
          .update(payload)
          .eq('id', draft.id)
          .eq('user_id', userId)
          .eq('updated_at', original.updated_at)
      : client().from('journal_entries').upsert(payload, { onConflict: 'id' })
    const { data, error } = await query.select(journalColumns).maybeSingle()
    if (error) throw error
    if (!data)
      throw new Error(
        'Cette entrée a changé dans une autre session. Votre texte est conservé ici ; copiez-le avant de recharger l’entrée.',
      )
    return data
  },
}
export type JournalRepository = typeof journalRepository
