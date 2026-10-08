export const currencies = ['MAD', 'XOF', 'EUR', 'USD'] as const
export type Currency = typeof currencies[number]
export type Account = { id: string; name: string; currency: Currency; openingMinor: number; openingDate: string; archived: boolean }
export type MoneyEntry = { id: string; date: string; type: 'income' | 'expense' | 'transfer'; accountId: string; destinationId?: string; amountMinor: number; destinationMinor?: number; category: string; label: string; status: 'planned' | 'booked'; cancelled: boolean; recurrenceId?: string }
export type Budget = { id: string; month: string; currency: Currency; category: string; limitMinor: number }
export type SavingGoal = { id: string; name: string; accountId: string; targetMinor: number; targetDate: string }
export type Recurrence = { id: string; accountId: string; type: 'income' | 'expense'; amountMinor: number; category: string; label: string; day: number; active: boolean }
export type FinanceState = { version: 1; accounts: Account[]; entries: MoneyEntry[]; budgets: Budget[]; goals: SavingGoal[]; recurrences: Recurrence[] }
export const emptyFinances = (): FinanceState => ({ version: 1, accounts: [], entries: [], budgets: [], goals: [], recurrences: [] })
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export function validDate(date: string) { return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date }
export function parseMoney(value: string, currency: Currency): number {
  const decimals = currency === 'XOF' ? 0 : 2
  const normalized = value.trim().replace(',', '.')
  if (!(decimals ? /^-?\d+(?:\.\d{1,2})?$/ : /^-?\d+$/).test(normalized)) throw new Error(`Montant invalide : ${decimals ? 'deux décimales au maximum' : 'montant entier en XOF'}.`)
  const minor = Math.round(Number(normalized) * 10 ** decimals)
  if (!Number.isSafeInteger(minor) || Math.abs(minor) > 100000000000) throw new Error('Montant trop élevé.')
  return minor
}
export function money(minor: number, currency: Currency) { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: currency === 'XOF' ? 0 : 2 }).format(minor / (currency === 'XOF' ? 1 : 100)) }
export function validateFinances(value: unknown): asserts value is FinanceState {
  if (!value || typeof value !== 'object') throw new Error('Données financières invalides.')
  const state = value as FinanceState
  if (state.version !== 1 || [state.accounts, state.entries, state.budgets, state.goals, state.recurrences].some(items => !Array.isArray(items) || items.length > 10000)) throw new Error('Données financières incomplètes ou trop volumineuses.')
  const checkId = (items: { id: string }[]) => { const ids = new Set<string>(); for (const item of items) { if (!item || !uuid.test(item.id) || ids.has(item.id)) throw new Error('Identifiant financier invalide ou répété.'); ids.add(item.id) } }
  for (const items of [state.accounts, state.entries, state.budgets, state.goals, state.recurrences]) checkId(items)
  const accounts = new Map(state.accounts.map(a => [a.id, a]))
  const text = (s: string, max = 160) => typeof s === 'string' && s.trim().length > 0 && s.length <= max
  const positive = (n: number) => Number.isSafeInteger(n) && n > 0 && n <= 100000000000
  const accountFor = (id: string) => { const account = accounts.get(id); if (!account) throw new Error('Compte financier introuvable.'); return account }
  for (const a of state.accounts) if (!text(a.name) || !currencies.includes(a.currency) || !Number.isSafeInteger(a.openingMinor) || Math.abs(a.openingMinor) > 100000000000 || !validDate(a.openingDate) || typeof a.archived !== 'boolean') throw new Error('Compte financier invalide.')
  for (const e of state.entries) {
    const account = accountFor(e.accountId)
    if (!validDate(e.date) || e.date < account.openingDate || !positive(e.amountMinor) || !['income', 'expense', 'transfer'].includes(e.type) || !['planned', 'booked'].includes(e.status) || !text(e.category, 80) || !text(e.label) || typeof e.cancelled !== 'boolean') throw new Error('Opération invalide : vérifiez la date, le montant et le libellé.')
    if (e.type === 'transfer') {
      const destination = accountFor(e.destinationId ?? '')
      if (destination.id === account.id || e.date < destination.openingDate || !positive(e.destinationMinor!) || (destination.currency === account.currency && e.destinationMinor !== e.amountMinor)) throw new Error('Virement invalide. Précisez le montant reçu en cas de change.')
    } else if (e.destinationId || e.destinationMinor !== undefined) throw new Error('Une opération simple ne possède pas de compte destinataire.')
    if (e.recurrenceId && !uuid.test(e.recurrenceId)) throw new Error('Récurrence invalide.')
  }
  const budgetKeys = new Set<string>()
  for (const b of state.budgets) {
    const key = `${b.month}:${b.currency}:${b.category.trim().toLowerCase()}`
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(b.month) || !currencies.includes(b.currency) || !text(b.category, 80) || !positive(b.limitMinor) || budgetKeys.has(key)) throw new Error('Budget invalide ou déjà défini pour cette catégorie.')
    budgetKeys.add(key)
  }
  for (const g of state.goals) { accountFor(g.accountId); if (!text(g.name) || !positive(g.targetMinor) || !validDate(g.targetDate)) throw new Error('Objectif d’épargne invalide.') }
  for (const r of state.recurrences) { accountFor(r.accountId); if (!['income', 'expense'].includes(r.type) || !positive(r.amountMinor) || !text(r.category, 80) || !text(r.label) || !Number.isInteger(r.day) || r.day < 1 || r.day > 31 || typeof r.active !== 'boolean') throw new Error('Charge ou revenu récurrent invalide.') }
}
export function accountBalance(state: FinanceState, account: Account, asOf: string) {
  if (asOf < account.openingDate) return null
  let balance = account.openingMinor
  for (const e of state.entries) {
    if (e.cancelled || e.status !== 'booked' || e.date > asOf || e.date < account.openingDate) continue
    if (e.accountId === account.id) balance += e.type === 'income' ? e.amountMinor : -e.amountMinor
    if (e.type === 'transfer' && e.destinationId === account.id) balance += e.destinationMinor!
  }
  return balance
}
export function monthlyTotals(state: FinanceState, month: string, currency: Currency, status: MoneyEntry['status'], category?: string) {
  const accounts = new Map(state.accounts.map(a => [a.id, a]))
  const selected = state.entries.filter(e => !e.cancelled && e.status === status && e.date.startsWith(month + '-') && e.type !== 'transfer' && accounts.get(e.accountId)?.currency === currency && (!category || e.category.trim().toLowerCase() === category.trim().toLowerCase()))
  return { income: selected.filter(e => e.type === 'income').reduce((n, e) => n + e.amountMinor, 0), expense: selected.filter(e => e.type === 'expense').reduce((n, e) => n + e.amountMinor, 0) }
}
export function materializeRecurrences(state: FinanceState, month: string, makeId: () => string): FinanceState {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Choisissez un mois valide.')
  const [year, number] = month.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, number, 0)).getUTCDate()
  const entries = [...state.entries]
  for (const r of state.recurrences.filter(r => r.active && !state.accounts.find(a => a.id === r.accountId)?.archived)) {
    if (entries.some(e => e.recurrenceId === r.id && e.date.startsWith(month + '-'))) continue
    const date = `${month}-${String(Math.min(r.day, lastDay)).padStart(2, '0')}`
    if (date < state.accounts.find(a => a.id === r.accountId)!.openingDate) continue
    entries.push({ id: makeId(), date, type: r.type, accountId: r.accountId, amountMinor: r.amountMinor, category: r.category, label: r.label, status: 'planned', cancelled: false, recurrenceId: r.id })
  }
  return { ...state, entries }
}
