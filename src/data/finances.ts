import { emptyFinances, validateFinances, type FinanceState } from '../domain/finances'
import { supabase } from '../lib/supabase'
export type FinanceSnapshot = { state: FinanceState; revision: number }
function client() { if (!supabase) throw new Error('Connexion à Horizon indisponible.'); return supabase }
export async function loadFinances(userId: string): Promise<FinanceSnapshot> {
  const { data, error } = await client().from('finance_state').select('payload,revision').eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (!data) return { state: emptyFinances(), revision: 0 }
  validateFinances(data.payload)
  return { state: data.payload, revision: data.revision }
}
export async function saveFinances(state: FinanceState, revision: number): Promise<FinanceSnapshot> {
  validateFinances(state)
  const { data, error } = await client().rpc('save_finances', { expected_revision: revision, next_payload: state })
  if (error) throw new Error(error.message.includes('finance_conflict') ? 'Une autre session a modifié les finances. Rechargez avant de réessayer.' : error.message)
  return { state, revision: Number(data) }
}
