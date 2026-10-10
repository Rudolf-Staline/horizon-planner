import { useEffect, useState } from 'react'
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Landmark, Plus, RefreshCw, Wallet } from 'lucide-react'
import { loadFinances, saveFinances, type FinanceSnapshot } from '../data/finances'
import { accountBalance, currencies, materializeRecurrences, money, monthlyTotals, parseMoney, type Currency, type FinanceState, type MoneyEntry } from '../domain/finances'
import '../styles/finances.css'

type Tab = 'overview' | 'accounts' | 'entries' | 'budgets' | 'goals' | 'recurrences'
const tabs: [Tab, string][] = [['overview', 'Vue d’ensemble'], ['accounts', 'Comptes'], ['entries', 'Opérations'], ['budgets', 'Budgets'], ['goals', 'Épargne'], ['recurrences', 'Récurrences']]
const categories = ['Alimentation', 'Logement', 'Transport', 'Études', 'Abonnements', 'Santé', 'Sport', 'Loisirs', 'Bourse', 'Salaire', 'Autre']
const emptyEntry = (today: string) => ({ date: today, type: 'expense' as MoneyEntry['type'], accountId: '', destinationId: '', amount: '', destination: '', category: 'Alimentation', label: '', status: 'booked' as MoneyEntry['status'] })
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Enregistrement impossible.'
export function FinancesView({ userId, today }: { userId: string; today: string }) {
  const [snapshot, setSnapshot] = useState<FinanceSnapshot | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')
  const [month, setMonth] = useState(today.slice(0, 7))
  const [currency, setCurrency] = useState<Currency>('MAD')
  const [account, setAccount] = useState({ name: '', currency: 'MAD' as Currency, opening: '', date: today })
  const [entry, setEntry] = useState(emptyEntry(today))
  const [showCancelled, setShowCancelled] = useState(false)
  const [editingEntry, setEditingEntry] = useState<string | null>(null)
  const [budget, setBudget] = useState({ category: 'Alimentation', amount: '' })
  const [goal, setGoal] = useState({ name: '', accountId: '', amount: '', date: today })
  const [recurrence, setRecurrence] = useState({ accountId: '', type: 'expense' as 'income' | 'expense', category: 'Abonnements', label: '', amount: '', day: '1' })
  useEffect(() => {
    let live = true
    setSnapshot(null); setError('')
    void loadFinances(userId).then(value => { if (live) setSnapshot(value) }).catch(reason => { if (live) setError(errorText(reason)) })
    return () => { live = false }
  }, [userId])
  const refresh = async () => { setBusy(true); setError(''); try { setSnapshot(await loadFinances(userId)) } catch (reason) { setError(errorText(reason)) } finally { setBusy(false) } }
  const commit = async (next: FinanceState) => {
    if (!snapshot || busy) return false
    setBusy(true); setError(''); setNotice('')
    try { setSnapshot(await saveFinances(next, snapshot.revision)); setNotice('Finances enregistrées dans votre compte.'); return true }
    catch (reason) { setError(errorText(reason)); return false }
    finally { setBusy(false) }
  }
  const state = snapshot?.state
  const selectedAccount = state?.accounts.find(a => a.id === entry.accountId)
  const destinationAccount = state?.accounts.find(a => a.id === entry.destinationId)
  const accountOptions = (current?: string) => state?.accounts.filter(a => !a.archived || a.id === current).map(a => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)
  const categoryOptions = () => [...new Set([...categories, ...(state?.entries.map(e => e.category) ?? [])])].map(value => <option key={value}>{value}</option>)
  const saveAccount = async (event: React.FormEvent) => {
    event.preventDefault(); if (!state) return
    try {
      const next = { ...state, accounts: [...state.accounts, { id: crypto.randomUUID(), name: account.name.trim(), currency: account.currency, openingMinor: parseMoney(account.opening, account.currency), openingDate: account.date, archived: false }] }
      if (await commit(next)) setAccount({ name: '', currency: account.currency, opening: '', date: today })
    } catch (reason) { setError(errorText(reason)) }
  }
  const saveEntry = async (event: React.FormEvent) => {
    event.preventDefault(); if (!state || !selectedAccount) return
    try {
      const amountMinor = parseMoney(entry.amount, selectedAccount.currency)
      const next: MoneyEntry = { id: editingEntry ?? crypto.randomUUID(), date: entry.date, type: entry.type, accountId: entry.accountId, amountMinor, category: entry.type === 'transfer' ? 'Virement' : entry.category, label: entry.label.trim(), status: entry.status, cancelled: false }
      if (editingEntry) next.recurrenceId = state.entries.find(e => e.id === editingEntry)?.recurrenceId
      if (entry.type === 'transfer') {
        if (!destinationAccount) throw new Error('Choisissez le compte destinataire.')
        next.destinationId = destinationAccount.id
        next.destinationMinor = destinationAccount.currency === selectedAccount.currency ? amountMinor : parseMoney(entry.destination, destinationAccount.currency)
      }
      if (await commit({ ...state, entries: editingEntry ? state.entries.map(e => e.id === editingEntry ? next : e) : [...state.entries, next] })) { setEntry(emptyEntry(today)); setEditingEntry(null) }
    } catch (reason) { setError(errorText(reason)) }
  }
  const editEntry = (value: MoneyEntry) => {
    if (!state) return
    const source = state.accounts.find(a => a.id === value.accountId)!
    const dest = state.accounts.find(a => a.id === value.destinationId)
    setEditingEntry(value.id)
    setEntry({ date: value.date, type: value.type, accountId: value.accountId, destinationId: value.destinationId ?? '', amount: String(value.amountMinor / (source.currency === 'XOF' ? 1 : 100)), destination: value.destinationMinor && dest ? String(value.destinationMinor / (dest.currency === 'XOF' ? 1 : 100)) : '', category: value.category, label: value.label, status: value.status })
  }
  const saveBudget = async (event: React.FormEvent) => {
    event.preventDefault(); if (!state) return
    try {
      const old = state.budgets.find(b => b.month === month && b.currency === currency && b.category === budget.category)
      const next = { id: old?.id ?? crypto.randomUUID(), month, currency, category: budget.category, limitMinor: parseMoney(budget.amount, currency) }
      if (await commit({ ...state, budgets: [...state.budgets.filter(b => b.id !== next.id), next] })) setBudget({ ...budget, amount: '' })
    } catch (reason) { setError(errorText(reason)) }
  }
  const saveGoal = async (event: React.FormEvent) => {
    event.preventDefault(); if (!state) return
    try {
      const targetAccount = state.accounts.find(a => a.id === goal.accountId)
      if (!targetAccount) throw new Error('Choisissez le compte d’épargne.')
      const next = { id: crypto.randomUUID(), name: goal.name.trim(), accountId: goal.accountId, targetMinor: parseMoney(goal.amount, targetAccount.currency), targetDate: goal.date }
      if (await commit({ ...state, goals: [...state.goals, next] })) setGoal({ name: '', accountId: '', amount: '', date: today })
    } catch (reason) { setError(errorText(reason)) }
  }
  const saveRecurrence = async (event: React.FormEvent) => {
    event.preventDefault(); if (!state) return
    try {
      const source = state.accounts.find(a => a.id === recurrence.accountId)
      if (!source) throw new Error('Choisissez un compte.')
      const next = { id: crypto.randomUUID(), accountId: source.id, type: recurrence.type, amountMinor: parseMoney(recurrence.amount, source.currency), category: recurrence.category, label: recurrence.label.trim(), day: Number(recurrence.day), active: true }
      if (await commit({ ...state, recurrences: [...state.recurrences, next] })) setRecurrence({ ...recurrence, label: '', amount: '' })
    } catch (reason) { setError(errorText(reason)) }
  }
  const actual = state ? monthlyTotals(state, month, currency, 'booked') : { income: 0, expense: 0 }
  const planned = state ? monthlyTotals(state, month, currency, 'planned') : { income: 0, expense: 0 }
  const activeAccounts = state?.accounts.filter(a => !a.archived) ?? []
  const selectedBalances = state ? activeAccounts.filter(a => a.currency === currency).flatMap(a => { const balance = accountBalance(state, a, today); return balance === null ? [] : [{ account: a, balance }] }) : []
  const availableBalance = selectedBalances.reduce((sum, item) => sum + item.balance, 0)
  const recentEntries = state?.entries.filter(e => !e.cancelled && e.date <= today && state.accounts.find(a => a.id === e.accountId)?.currency === currency).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4) ?? []
  const flowScale = Math.max(actual.income, actual.expense, 1)
  return <main className="finances-page">
    <header className="section-header finance-heading">
      <div><span className="section-kicker">HORIZON / VOTRE ARGENT</span><h1>Finances<span aria-hidden="true">.</span></h1><p>Une vue nette sur ce que vous avez, ce qui entre et ce qui sort.</p></div>
      <button className="btn secondary finance-refresh" disabled={busy} onClick={() => void refresh()}><RefreshCw size={16}/> Actualiser</button>
    </header>
    {error && <p className="planning-error" role="alert">{error}</p>}
    {notice && <p className="settings-notice" role="status">{notice}</p>}
    {!snapshot && !error && <p role="status">Chargement des finances…</p>}
    {state && <>
      <nav className="finance-tabs" aria-label="Vues des finances">{tabs.map(([value, label]) => <button className={`btn ${tab === value ? 'primary' : 'secondary'}`} aria-current={tab === value ? 'page' : undefined} key={value} onClick={() => setTab(value)}>{label}</button>)}</nav>
      {['overview', 'entries', 'budgets', 'recurrences'].includes(tab) && <div className="finance-filters"><span className="finance-filter-caption">PÉRIODE ET DEVISE</span><label>Mois<input type="month" value={month} onChange={e => setMonth(e.target.value)}/></label>{tab !== 'recurrences' && <label>Devise<select value={currency} onChange={e => setCurrency(e.target.value as Currency)}>{currencies.map(c => <option key={c}>{c}</option>)}</select></label>}</div>}
      {tab === 'overview' && <>
        <section className="finance-dashboard" aria-label="Synthèse du mois">
          <article className="finance-balance-panel">
            <div className="finance-panel-top"><span>SOLDE DISPONIBLE</span><Wallet size={20} strokeWidth={1.6}/></div>
            <strong>{money(availableBalance, currency)}</strong>
            <p>{selectedBalances.length ? `${selectedBalances.length} compte${selectedBalances.length > 1 ? 's' : ''} en ${currency} · au ${today}` : `Aucun solde actuel en ${currency}`}</p>
            <div className="finance-balance-foot"><span>Flux du mois</span><b className={actual.income - actual.expense < 0 ? 'negative' : ''}>{actual.income - actual.expense >= 0 ? '+' : '−'}{money(Math.abs(actual.income - actual.expense), currency)}</b></div>
          </article>
          <article className="finance-flow-panel">
            <div className="finance-card-eyebrow">LE MOIS EN COURS</div>
            <h2>Entrées & sorties</h2>
            <div className="finance-flow-line income"><div><ArrowDownLeft size={17}/><span>Revenus reçus</span></div><strong>{money(actual.income, currency)}</strong><div className="finance-track"><i style={{ width: `${actual.income / flowScale * 100}%` }}/></div></div>
            <div className="finance-flow-line expense"><div><ArrowUpRight size={17}/><span>Dépenses payées</span></div><strong>{money(actual.expense, currency)}</strong><div className="finance-track"><i style={{ width: `${actual.expense / flowScale * 100}%` }}/></div></div>
            <p>Les virements entre comptes ne modifient pas ces flux.</p>
          </article>
        </section>
        <section className="finance-pending" aria-label="À venir"><div><span className="finance-card-eyebrow">À VENIR</span><p>Les opérations encore prévues pour {month}.</p></div><div><span>Revenus attendus<strong>{money(planned.income, currency)}</strong></span><span>Dépenses prévues<strong>{money(planned.expense, currency)}</strong></span></div></section>
        <div className="finance-overview-lower">
          <section className="finance-card finance-accounts-card"><div className="finance-card-head"><div><span className="finance-card-eyebrow">VOS REPÈRES</span><h2>Comptes</h2></div><button className="finance-text-link" onClick={() => setTab('accounts')}>Gérer <ArrowRight size={16}/></button></div>
            {activeAccounts.length ? activeAccounts.map(a => { const balance = accountBalance(state, a, today); return <div className="finance-row" key={a.id}><span className="finance-account-icon"><Landmark size={18}/></span><div><strong>{a.name}</strong><p>{a.currency}</p></div><strong>{balance === null ? 'Solde initial futur' : money(balance, a.currency)}</strong></div> }) : <div className="finance-empty"><p>Votre espace financier commence avec un compte.</p><button className="finance-text-link" onClick={() => setTab('accounts')}>Ajouter un compte <ArrowRight size={16}/></button></div>}
            <p className="finance-help">Les soldes restent séparés par devise.</p>
          </section>
          <section className="finance-card finance-recent-card"><div className="finance-card-head"><div><span className="finance-card-eyebrow">AU QUOTIDIEN</span><h2>Dernières opérations</h2></div><button className="finance-text-link" onClick={() => setTab('entries')}>Tout voir <ArrowRight size={16}/></button></div>
            {recentEntries.length ? recentEntries.map(e => { const a = state.accounts.find(a => a.id === e.accountId)!; return <div className="finance-row" key={e.id}><span className={`finance-entry-icon ${e.type}`}><ArrowUpRight size={17}/></span><div><strong>{e.label}</strong><p>{e.date} · {e.status === 'planned' ? 'Prévu' : e.category}</p></div><strong className={e.type === 'income' ? 'income-amount' : ''}>{e.type === 'income' ? '+' : '−'}{money(e.amountMinor, a.currency)}</strong></div> }) : <div className="finance-empty"><p>Aucune opération à afficher pour cette devise.</p><button className="finance-text-link" onClick={() => setTab('entries')}>Ajouter une opération <ArrowRight size={16}/></button></div>}
          </section>
        </div>
      </>}
      {tab === 'accounts' && <section className="finance-card"><h2>Mes comptes</h2>{state.accounts.map(a => <div className="finance-row" key={a.id}><div><strong>{a.name} · {a.currency}</strong><p>Solde initial : {money(a.openingMinor, a.currency)} au {a.openingDate}{a.archived ? ' · Archivé' : ''}</p></div><button className="btn secondary" disabled={busy} onClick={() => void commit({ ...state, accounts: state.accounts.map(v => v.id === a.id ? { ...v, archived: !v.archived } : v) })}>{a.archived ? 'Restaurer' : 'Archiver'}</button></div>)}<form className="finance-form" onSubmit={saveAccount}><h3>Ajouter un compte</h3><label>Nom du compte<input required maxLength={160} value={account.name} onChange={e => setAccount({ ...account, name: e.target.value })}/></label><label>Devise du compte<select value={account.currency} onChange={e => setAccount({ ...account, currency: e.target.value as Currency })}>{currencies.map(c => <option key={c}>{c}</option>)}</select></label><label>Solde initial<input required inputMode="decimal" value={account.opening} onChange={e => setAccount({ ...account, opening: e.target.value })}/></label><label>Date du solde initial<input required type="date" value={account.date} onChange={e => setAccount({ ...account, date: e.target.value })}/></label><button className="btn primary" disabled={busy}><Plus size={15}/> Ajouter le compte</button></form></section>}
      {tab === 'entries' && <section className="finance-card"><h2>Opérations · {month}</h2><label className="finance-check"><input type="checkbox" checked={showCancelled} onChange={e => setShowCancelled(e.target.checked)}/>Afficher les opérations annulées</label><div className="finance-entries">{state.entries.filter(e => e.date.startsWith(month + '-') && (!e.cancelled || showCancelled) && state.accounts.some(a => (a.id === e.accountId || a.id === e.destinationId) && a.currency === currency)).sort((a,b) => b.date.localeCompare(a.date)).map(e => { const a = state.accounts.find(a => a.id === e.accountId)!; return <div className={`finance-row ${e.cancelled ? 'cancelled' : ''}`} key={e.id}><div><strong>{e.label}</strong><p>{e.date} · {e.category} · {a.name} · {e.cancelled ? 'Annulé' : e.status === 'planned' ? 'Prévu' : 'Enregistré'}</p></div><strong>{e.type === 'income' ? '+' : '−'}{money(e.amountMinor, a.currency)}{e.type === 'transfer' && ` → ${money(e.destinationMinor!, state.accounts.find(a => a.id === e.destinationId)!.currency)}`}</strong><div className="finance-actions"><button className="btn secondary" disabled={busy} onClick={() => editEntry(e)}>Modifier</button>{e.status === 'planned' && !e.cancelled && <button className="btn secondary" disabled={busy || e.date > today} onClick={() => void commit({ ...state, entries: state.entries.map(v => v.id === e.id ? { ...v, status: 'booked' } : v) })}>Reçu / payé</button>}<button className="btn secondary" disabled={busy} onClick={() => void commit({ ...state, entries: state.entries.map(v => v.id === e.id ? { ...v, cancelled: !v.cancelled } : v) })}>{e.cancelled ? 'Restaurer' : 'Annuler'}</button></div></div> })}</div>
        {!state.accounts.some(a => !a.archived) && <p>Créez d’abord un compte dans l’onglet Comptes.</p>}
        <form className="finance-form" onSubmit={saveEntry}><h3>{editingEntry ? 'Modifier l’opération' : 'Ajouter une opération'}</h3><label>Type d’opération<select value={entry.type} onChange={e => setEntry({ ...entry, type: e.target.value as MoneyEntry['type'] })}><option value="expense">Dépense</option><option value="income">Revenu</option><option value="transfer">Virement entre mes comptes</option></select></label><label>Compte source<select required value={entry.accountId} onChange={e => setEntry({ ...entry, accountId: e.target.value })}><option value="">Choisir un compte</option>{accountOptions(entry.accountId)}</select></label><label>Montant {selectedAccount?.currency}<input required inputMode="decimal" value={entry.amount} onChange={e => setEntry({ ...entry, amount: e.target.value })}/></label><label>Date de l’opération<input required type="date" max={entry.status === 'booked' ? today : undefined} value={entry.date} onChange={e => setEntry({ ...entry, date: e.target.value })}/></label>{entry.type === 'transfer' && <><label>Compte destinataire<select required value={entry.destinationId} onChange={e => setEntry({ ...entry, destinationId: e.target.value })}><option value="">Choisir un compte</option>{accountOptions(entry.destinationId)}</select></label>{selectedAccount && destinationAccount && selectedAccount.currency !== destinationAccount.currency && <label>Montant reçu en {destinationAccount.currency}<input required inputMode="decimal" value={entry.destination} onChange={e => setEntry({ ...entry, destination: e.target.value })}/></label>}</>}<label>Libellé<input required maxLength={160} value={entry.label} onChange={e => setEntry({ ...entry, label: e.target.value })}/></label>{entry.type !== 'transfer' && <label>Catégorie<select value={entry.category} onChange={e => setEntry({ ...entry, category: e.target.value })}>{categoryOptions()}</select></label>}<label>État de l’opération<select value={entry.status} onChange={e => setEntry({ ...entry, status: e.target.value as MoneyEntry['status'] })}><option value="booked">Reçu / payé</option><option value="planned">Prévu / en attente</option></select></label><div className="finance-actions"><button className="btn primary" disabled={busy || !selectedAccount}>Enregistrer l’opération</button>{editingEntry && <button type="button" className="btn secondary" onClick={() => { setEditingEntry(null); setEntry(emptyEntry(today)) }}>Fermer la modification</button>}</div></form>
      </section>}
      {tab === 'budgets' && <section className="finance-card"><h2>Budgets · {month} · {currency}</h2>{state.budgets.filter(b => b.month === month && b.currency === currency).map(b => { const spent = monthlyTotals(state, month, currency, 'booked', b.category).expense; return <div className="finance-budget" key={b.id}><div className="finance-row"><strong>{b.category}</strong><span>{money(spent, currency)} / {money(b.limitMinor, currency)}</span></div><progress max={b.limitMinor} value={Math.min(spent, b.limitMinor)}/><p>{spent > b.limitMinor ? `Dépassement : ${money(spent - b.limitMinor, currency)}` : `Disponible dans le budget : ${money(b.limitMinor - spent, currency)}`}</p></div> })}<form className="finance-form" onSubmit={saveBudget}><h3>Définir ou modifier un budget</h3><label>Catégorie du budget<select value={budget.category} onChange={e => setBudget({ ...budget, category: e.target.value })}>{categoryOptions()}</select></label><label>Plafond en {currency}<input required inputMode="decimal" value={budget.amount} onChange={e => setBudget({ ...budget, amount: e.target.value })}/></label><button className="btn primary" disabled={busy}>Enregistrer le budget</button></form></section>}
      {tab === 'goals' && <section className="finance-card"><h2>Objectifs d’épargne</h2><p className="finance-help">La progression correspond au solde réel du compte choisi. Utilisez un compte distinct pour chaque objectif si les fonds doivent être réservés.</p>{state.goals.map(g => { const a = state.accounts.find(a => a.id === g.accountId)!; const balance = Math.max(0, accountBalance(state, a, today) ?? 0); return <div className="finance-budget" key={g.id}><div className="finance-row"><strong>{g.name}</strong><span>{money(balance, a.currency)} / {money(g.targetMinor, a.currency)}</span></div><progress max={g.targetMinor} value={Math.min(balance, g.targetMinor)}/><p>{a.name} · Cible au {g.targetDate}</p></div> })}<form className="finance-form" onSubmit={saveGoal}><h3>Ajouter un objectif</h3><label>Nom de l’objectif<input required maxLength={160} value={goal.name} onChange={e => setGoal({ ...goal, name: e.target.value })}/></label><label>Compte d’épargne<select required value={goal.accountId} onChange={e => setGoal({ ...goal, accountId: e.target.value })}><option value="">Choisir un compte</option>{accountOptions()}</select></label><label>Montant cible<input required inputMode="decimal" value={goal.amount} onChange={e => setGoal({ ...goal, amount: e.target.value })}/></label><label>Date cible<input required type="date" value={goal.date} onChange={e => setGoal({ ...goal, date: e.target.value })}/></label><button className="btn primary" disabled={busy}>Ajouter l’objectif</button></form></section>}
      {tab === 'recurrences' && <section className="finance-card"><h2>Charges et revenus récurrents</h2><p className="finance-help">Générez les opérations prévues pour le mois choisi, puis confirmez chaque paiement ou encaissement. Une seconde génération conserve les opérations déjà présentes.</p><button className="btn secondary" disabled={busy} onClick={() => { try { void commit(materializeRecurrences(state, month, () => crypto.randomUUID())) } catch (reason) { setError(errorText(reason)) } }}>Préparer les opérations de {month}</button>{state.recurrences.map(r => <div className="finance-row" key={r.id}><div><strong>{r.label}</strong><p>Jour {r.day} · {money(r.amountMinor, state.accounts.find(a => a.id === r.accountId)!.currency)} · {r.active ? 'Actif' : 'En pause'}</p></div><button className="btn secondary" disabled={busy} onClick={() => void commit({ ...state, recurrences: state.recurrences.map(v => v.id === r.id ? { ...v, active: !v.active } : v) })}>{r.active ? 'Mettre en pause' : 'Reprendre'}</button></div>)}<form className="finance-form" onSubmit={saveRecurrence}><h3>Ajouter une récurrence mensuelle</h3><label>Libellé récurrent<input required maxLength={160} value={recurrence.label} onChange={e => setRecurrence({ ...recurrence, label: e.target.value })}/></label><label>Compte de la récurrence<select required value={recurrence.accountId} onChange={e => setRecurrence({ ...recurrence, accountId: e.target.value })}><option value="">Choisir un compte</option>{accountOptions()}</select></label><label>Type de récurrence<select value={recurrence.type} onChange={e => setRecurrence({ ...recurrence, type: e.target.value as 'income' | 'expense' })}><option value="expense">Dépense</option><option value="income">Revenu</option></select></label><label>Montant récurrent<input required inputMode="decimal" value={recurrence.amount} onChange={e => setRecurrence({ ...recurrence, amount: e.target.value })}/></label><label>Catégorie récurrente<select value={recurrence.category} onChange={e => setRecurrence({ ...recurrence, category: e.target.value })}>{categoryOptions()}</select></label><label>Jour du mois<input required type="number" min="1" max="31" value={recurrence.day} onChange={e => setRecurrence({ ...recurrence, day: e.target.value })}/></label><button className="btn primary" disabled={busy}>Ajouter la récurrence</button></form></section>}
    </>}
  </main>
}
