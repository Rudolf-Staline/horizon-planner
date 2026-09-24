import { useState } from 'react'
import { Cloud, LogOut, Mail, X } from 'lucide-react'
import type { CloudStatus } from '../state/planner'
import { sendMagicLink, signOut } from '../data/auth'
import { supabaseConfigured } from '../lib/supabase'

interface Props {
  cloudStatus: CloudStatus
  userEmail: string | null
  onClose: () => void
}

export function AccountDialog({
  cloudStatus,
  userEmail,
  onClose,
}: Props) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!email.trim()) return

    setBusy(true)
    setError(null)

    try {
      await sendMagicLink(email.trim())
      setSent(true)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossible d’envoyer le lien de connexion.',
      )
    } finally {
      setBusy(false)
    }
  }

  const logout = async () => {
    setBusy(true)
    setError(null)

    try {
      await signOut()
      onClose()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Déconnexion impossible.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="account-overlay" onMouseDown={onClose}>
      <section
        className="account-dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="account-head">
          <div className="account-icon"><Cloud size={20}/></div>
          <div>
            <h2>Compte & synchronisation</h2>
            <p>
              Horizon garde un cache local isolé par compte et le synchronise
              avec ton espace cloud.
            </p>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={18}/>
          </button>
        </div>

        {!supabaseConfigured ? (
          <div className="account-local">
            <strong>Mode local</strong>
            <p>
              Aucun projet Supabase n’est configuré. Tes données restent dans
              ce navigateur.
            </p>
            <code>VITE_SUPABASE_URL</code>
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>
          </div>
        ) : userEmail ? (
          <div className="account-connected">
            <div>
              <span>Connecté avec</span>
              <strong>{userEmail}</strong>
            </div>

            <div className={`cloud-state cloud-state-${cloudStatus}`}>
              <span className="cloud-state-dot"/>
              {cloudStatus === 'synced' && 'Synchronisé'}
              {cloudStatus === 'syncing' && 'Synchronisation…'}
              {cloudStatus === 'error' && 'Erreur de synchronisation'}
              {cloudStatus === 'local' && 'Local uniquement'}
            </div>

            <button
              className="account-signout"
              disabled={busy}
              onClick={logout}
            >
              <LogOut size={16}/>
              Se déconnecter de cet appareil
            </button>
          </div>
        ) : sent ? (
          <div className="magic-sent">
            <Mail size={22}/>
            <strong>Vérifie ta boîte mail</strong>
            <p>
              Le lien de connexion a été envoyé à <b>{email}</b>.
            </p>
          </div>
        ) : (
          <div className="account-login">
            <label>
              <span>Adresse e-mail</span>
              <input
                type="email"
                placeholder="toi@exemple.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submit()
                }}
              />
            </label>

            <button
              className="btn primary"
              disabled={busy || !email.trim()}
              onClick={submit}
            >
              {busy ? 'Envoi…' : 'Recevoir un lien magique'}
            </button>
          </div>
        )}

        {error && <p className="planning-error">{error}</p>}
      </section>
    </div>
  )
}
