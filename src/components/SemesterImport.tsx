import { useMemo, useState } from 'react'
import { Calendar, Upload, RefreshCw } from 'lucide-react'
import type { PlannerEvent } from '../domain/types'
import { edtChanges, emptyGroups, groupFamilies, initialEdt, readEdtExcel, selectEdt, semesterKey, type EdtGroups, type EdtSnapshot } from '../data/edtExcel'

type Props = { userId: string; events: PlannerEvent[]; onImportEvents: (events: PlannerEvent[], key: string) => void }
export function SemesterImport({ userId, events, onImportEvents }: Props) {
  const storageKey = `horizon:edt-s7:v1:${userId}`
  const [saved] = useState(() => { try { return JSON.parse(localStorage.getItem(storageKey) || '{}') } catch { return {} } })
  const [snapshot, setSnapshot] = useState<EdtSnapshot>(saved.snapshot || initialEdt)
  const [groups, setGroups] = useState<EdtGroups>({ ...emptyGroups, ...saved.groups })
  const [url, setUrl] = useState<string>(saved.url || '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const selected = useMemo(() => selectEdt(snapshot.entries, groups), [snapshot, groups])
  const changes = useMemo(() => edtChanges(events, selected), [events, selected])
  const options = useMemo(() => [...new Set(snapshot.entries.flatMap(e => e.groups))], [snapshot])
  const saveSource = () => { localStorage.setItem(storageKey, JSON.stringify({ snapshot, groups, url })); setMessage('Source et groupes enregistrés sur cet appareil.') }
  const read = async (file: Blob) => {
    setBusy(true); setError(''); setMessage('')
    try { setSnapshot(await readEdtExcel(file)); setAcknowledged(false); setMessage('Nouvelle version lue. Vérifiez les changements avant de les appliquer.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Lecture impossible.') }
    finally { setBusy(false) }
  }
  const refresh = async () => {
    setBusy(true); setError(''); setMessage('')
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:') throw new Error('La source doit utiliser HTTPS.')
      const response = await fetch(parsed.href, { cache: 'no-store', credentials: 'omit' })
      if (!response.ok) throw new Error(`Source inaccessible (${response.status}).`)
      await read(await response.blob())
    } catch (cause) { setError(`Impossible de lire ce lien. Il doit télécharger directement le fichier Excel et autoriser l’accès depuis Horizon. Vous pouvez importer le fichier téléchargé. ${cause instanceof Error ? cause.message : ''}`) }
    finally { setBusy(false) }
  }
  const apply = () => {
    onImportEvents(selected.map(({ groups: _groups, sheet: _sheet, cell: _cell, ...event }) => event), semesterKey)
    localStorage.setItem(storageKey, JSON.stringify({ snapshot, groups, url }))
    setMessage('Planning appliqué. Consultez l’indicateur de synchronisation pour vérifier son enregistrement dans votre compte.')
  }
  return <article className="settings-card settings-schedule-import semester-import">
    <div className="settings-card-head"><Calendar size={18}/><div><h2>Tout le semestre S7</h2><p>Septembre 2026 à février 2027. Le fichier fourni est déjà disponible. Choisissez vos groupes, puis appliquez le planning.</p></div></div>
    <div className="settings-form-grid">{groupFamilies.map(family => <label key={family}><span>{family === 'LANG' ? 'Groupe de langue' : family === 'TD' ? 'Groupe de TD' : `Option ${family}`}</span><select value={groups[family]} onChange={e => { setGroups(g => ({ ...g, [family]: e.target.value })); setMessage('') }}><option value="">Aucun / pas encore choisi</option>{options.filter(g => g.startsWith(family)).sort((a,b) => Number(a.slice(family.length))-Number(b.slice(family.length))).map(g => <option key={g} value={g.slice(family.length)}>{g.replace('LANG', 'Langue ').replace('TD', 'TD ')}</option>)}</select></label>)}</div>
    <p>Les cours communs sont inclus. Les séances des groupes non choisis restent disponibles dans la source et ne sont pas ajoutées à votre agenda.</p>
    <label className="file-drop"><Upload size={18}/><span>{busy ? 'Lecture en cours…' : 'Importer une nouvelle version Excel'}</span><input type="file" accept=".xlsx" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (file) void read(file); e.currentTarget.value = '' }}/></label>
    <label><span>Lien permanent du fichier Excel</span><input type="url" placeholder="https://…/emploi-du-temps.xlsx" value={url} onChange={e => setUrl(e.target.value)}/></label>
    <div className="settings-action-row"><button className="btn secondary" disabled={busy || !url.trim()} onClick={() => void refresh()}><RefreshCw size={15}/> Vérifier la source</button><button className="btn secondary" disabled={busy} onClick={saveSource}>Enregistrer la source</button></div>
    <p>Pour une mise à jour, vérifiez le lien ou importez le nouveau fichier. Les changements sont affichés avant application. Le lien doit être accessible sans connexion ; une vérification automatique en arrière-plan n’est pas encore configurée.</p>
    {snapshot.warnings.length > 0 && <details><summary>{snapshot.warnings.length} corrections ou anomalies dans le classeur</summary><ul>{snapshot.warnings.map(w => <li key={w}>{w}</li>)}</ul></details>}
    {snapshot.warnings.length > 0 && <label className="settings-switch"><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)}/><span>J’ai vérifié les corrections de dates signalées.</span></label>}
    <div className="edt-import-review-head"><div><strong>{selected.length} séances sélectionnées</strong><span>{changes.added} ajouts · {changes.changed} modifications · {changes.removed} retraits</span></div><button className="btn primary" disabled={busy || (snapshot.warnings.length > 0 && !acknowledged)} onClick={apply}>Appliquer le planning</button></div>
    <details><summary>Consulter les séances sélectionnées</summary><div className="edt-import-list">{selected.map(e => <div key={e.externalId}><strong>{e.title}</strong><p>{e.date} · {String(Math.floor(e.startMin/60)).padStart(2,'0')}:{String(e.startMin%60).padStart(2,'0')} · {e.durationMin} min</p></div>)}</div></details>
    {message && <p className="settings-notice" role="status">{message}</p>}{error && <p className="planning-error" role="alert">{error}</p>}
  </article>
}
