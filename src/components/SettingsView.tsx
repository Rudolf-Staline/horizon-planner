import { Bell, Calendar, Download, Save, ShieldCheck, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { PlannerEvent } from '../domain/types'
import {
  minutesToTime,
  timeToMinutes,
  validatePlannerPreferences,
  type PlannerPreferences,
} from '../domain/preferences'
import {
  downloadJsonBackup,
  downloadPlannerIcs,
  exportAccountBackup,
  importAccountBackup,
  type HorizonBackup,
} from '../data/portable'
import { updatePlannerPreferences } from '../data/profile'
import {
  createCalendarSource,
  deleteCalendarSource,
  listCalendarSources,
  syncCalendarSource,
  type CalendarSource,
} from '../data/calendarSources'

interface Props {
  userId: string
  preferences: PlannerPreferences
  events: PlannerEvent[]
  onSaved: (preferences: PlannerPreferences) => void
  onOpenAccount: () => void
}

const dayLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export function SettingsView({ userId, preferences, events, onSaved, onOpenAccount }: Props) {
  const [draft, setDraft] = useState(preferences)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sources, setSources] = useState<CalendarSource[]>([])
  const [sourceName, setSourceName] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceProvider, setSourceProvider] = useState<CalendarSource['provider']>('ics')
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  )

  useEffect(() => setDraft(preferences), [preferences])
  useEffect(() => { void listCalendarSources(userId).then(setSources).catch(() => setSources([])) }, [userId])

  const save = async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      validatePlannerPreferences(draft)
      await updatePlannerPreferences(userId, draft)
      onSaved(draft)
      setNotice('Préférences enregistrées.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible d’enregistrer les préférences.')
    } finally {
      setBusy(false)
    }
  }

  const exportJson = async () => {
    setBusy(true)
    setError(null)
    try {
      const backup = await exportAccountBackup(userId)
      downloadJsonBackup(backup)
      setNotice('Sauvegarde JSON téléchargée.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Export impossible.')
    } finally {
      setBusy(false)
    }
  }

  const importJson = async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      const parsed = JSON.parse(await file.text()) as HorizonBackup
      await importAccountBackup(userId, parsed)
      setNotice('Sauvegarde importée. Horizon va recharger vos données.')
      window.setTimeout(() => window.location.reload(), 650)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Import impossible.')
    } finally {
      setBusy(false)
    }
  }

  const requestNotifications = async () => {
    if (typeof Notification === 'undefined') return
    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)
    if (permission === 'granted') setNotice('Les rappels de navigateur sont autorisés.')
  }

  const addSource = async () => {
    if (!sourceName.trim() || !sourceUrl.trim() || busy) return
    setBusy(true); setError(null)
    try {
      await createCalendarSource(userId, { name: sourceName.trim(), feedUrl: sourceUrl.trim(), provider: sourceProvider })
      setSources(await listCalendarSources(userId)); setSourceName(''); setSourceUrl(''); setNotice('Source externe ajoutée.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Impossible d’ajouter la source.') }
    finally { setBusy(false) }
  }

  const syncSource = async (source: CalendarSource) => {
    setBusy(true); setError(null)
    try { const result = await syncCalendarSource(source.id); setSources(await listCalendarSources(userId)); setNotice(`${result.imported} événement(s) importé(s).`) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Synchronisation impossible.') }
    finally { setBusy(false) }
  }

  const setField = <K extends keyof PlannerPreferences>(key: K, value: PlannerPreferences[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  return (
    <main className="settings-page">
      <header className="section-header">
        <div>
          <span className="section-kicker">CONFIGURATION</span>
          <h1>Paramètres</h1>
          <p>Réglez la journée de travail, le moteur de planification et vos rappels.</p>
        </div>
        <button className="btn primary" disabled={busy} onClick={() => void save()}>
          <Save size={16}/> Enregistrer
        </button>
      </header>

      <section className="settings-grid">
        <article className="settings-card">
          <div className="settings-card-head"><Calendar size={18}/><div><h2>Calendrier</h2><p>Ces valeurs déterminent les vues et les gestes du calendrier.</p></div></div>
          <div className="settings-form-grid">
            <label><span>Fuseau horaire</span><input value={draft.timezone} onChange={(e) => setField('timezone', e.target.value)} placeholder="Africa/Casablanca"/></label>
            <label><span>Premier jour de la semaine</span><select value={draft.weekStartsOn} onChange={(e) => setField('weekStartsOn', Number(e.target.value))}><option value={1}>Lundi</option><option value={0}>Dimanche</option><option value={6}>Samedi</option></select></label>
            <label><span>Début de journée</span><input type="time" value={minutesToTime(draft.workdayStartMin)} onChange={(e) => setField('workdayStartMin', timeToMinutes(e.target.value))}/></label>
            <label><span>Fin de journée</span><input type="time" value={minutesToTime(draft.workdayEndMin)} onChange={(e) => setField('workdayEndMin', timeToMinutes(e.target.value))}/></label>
          </div>
          <div className="settings-days"><span>Jours actifs</span><div>{dayLabels.map((label, index) => <button key={label} type="button" className={draft.activeDays.includes(index) ? 'active' : ''} onClick={() => setField('activeDays', draft.activeDays.includes(index) ? draft.activeDays.filter((day) => day !== index) : [...draft.activeDays, index].sort())}>{label}</button>)}</div></div>
        </article>

        <article className="settings-card">
          <div className="settings-card-head"><ShieldCheck size={18}/><div><h2>Planification</h2><p>Le moteur conserve ces préférences comme des contraintes souples.</p></div></div>
          <div className="settings-form-grid">
            <label><span>Durée par défaut (min)</span><input type="number" min="15" step="15" value={draft.defaultDurationMin} onChange={(e) => setField('defaultDurationMin', Number(e.target.value))}/></label>
            <label><span>Bloc de concentration (min)</span><input type="number" min="15" step="5" value={draft.focusBlockMin} onChange={(e) => setField('focusBlockMin', Number(e.target.value))}/></label>
            <label><span>Marge entre activités (min)</span><input type="number" min="0" step="5" value={draft.bufferMin} onChange={(e) => setField('bufferMin', Number(e.target.value))}/></label>
            <label><span>Pas du calendrier</span><select value={draft.planningStepMin} onChange={(e) => setField('planningStepMin', Number(e.target.value))}><option value={5}>5 minutes</option><option value={10}>10 minutes</option><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={60}>60 minutes</option></select></label>
            <label><span>Énergie privilégiée</span><select value={draft.energyPreference} onChange={(e) => setField('energyPreference', e.target.value as PlannerPreferences['energyPreference'])}><option value="balanced">Équilibrée</option><option value="low">Faible effort d’abord</option><option value="high">Effort intense d’abord</option></select></label>
          </div>
        </article>

        <article className="settings-card">
          <div className="settings-card-head"><Bell size={18}/><div><h2>Rappels</h2><p>Les rappels restent locaux à cet appareil et ne modifient jamais votre planning.</p></div></div>
          <label className="settings-switch"><input type="checkbox" checked={draft.notificationsEnabled} onChange={(e) => setField('notificationsEnabled', e.target.checked)}/><span>Activer les rappels de navigateur</span></label>
          <label><span>Délai avant l’activité (min)</span><input type="number" min="0" max="120" step="5" value={draft.reminderLeadMin} onChange={(e) => setField('reminderLeadMin', Number(e.target.value))}/></label>
          <button className="btn secondary" disabled={notificationPermission === 'unsupported' || notificationPermission === 'granted'} onClick={() => void requestNotifications()}>{notificationPermission === 'granted' ? 'Notifications autorisées' : 'Autoriser les notifications'}</button>
        </article>

        <article className="settings-card">
          <div className="settings-card-head"><Download size={18}/><div><h2>Données et portabilité</h2><p>Vous pouvez récupérer vos données à tout moment, sans passer par l’administration.</p></div></div>
          <div className="settings-action-row"><button className="btn secondary" disabled={busy} onClick={() => void exportJson()}><Download size={15}/> Exporter JSON</button><button className="btn secondary" onClick={() => downloadPlannerIcs(events)}><Calendar size={15}/> Exporter calendrier ICS</button></div>
          <label className="file-drop"><Upload size={18}/><span>Importer une sauvegarde JSON</span><input type="file" accept="application/json,.json" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) void importJson(file); e.currentTarget.value = '' }}/></label>
        </article>
      </section>

      <section className="settings-card settings-account-link"><div><h2>Sécurité du compte</h2><p>Adresse e-mail, mot de passe, sessions et suppression du compte.</p></div><button className="btn secondary" onClick={onOpenAccount}>Ouvrir Mon compte</button></section>
      <section className="settings-card settings-sources">
        <div className="settings-card-head"><Calendar size={18}/><div><h2>Agendas externes</h2><p>Import en lecture seule depuis un flux ICS Google Calendar, Outlook ou une autre source compatible.</p></div></div>
        <div className="settings-source-form"><input placeholder="Nom de l’agenda" value={sourceName} onChange={(e) => setSourceName(e.target.value)}/><select value={sourceProvider} onChange={(e) => setSourceProvider(e.target.value as CalendarSource['provider'])}><option value="ics">ICS</option><option value="google">Google Calendar</option><option value="outlook">Outlook</option></select><input type="url" placeholder="https://…/calendar.ics" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)}/><button className="btn secondary" disabled={busy || !sourceName.trim() || !sourceUrl.trim()} onClick={() => void addSource()}>Ajouter</button></div>
        <div className="settings-source-list">{sources.map((source) => <article key={source.id}><div><strong>{source.name}</strong><span>{source.provider.toUpperCase()} · {source.lastSyncedAt ? `Dernière synchro ${new Date(source.lastSyncedAt).toLocaleString('fr-FR')}` : 'Jamais synchronisé'}</span>{source.lastError && <small>{source.lastError}</small>}</div><div><button className="btn secondary" disabled={busy} onClick={() => void syncSource(source)}>Synchroniser</button><button className="icon-button" aria-label={`Supprimer ${source.name}`} disabled={busy} onClick={() => { void deleteCalendarSource(source.id).then(async () => setSources(await listCalendarSources(userId))).catch((cause) => setError(cause instanceof Error ? cause.message : 'Suppression impossible.')) }}>×</button></div></article>)}</div>
      </section>
      {notice && <p className="settings-notice" role="status">{notice}</p>}
      {error && <p className="planning-error" role="alert">{error}</p>}
    </main>
  )
}
