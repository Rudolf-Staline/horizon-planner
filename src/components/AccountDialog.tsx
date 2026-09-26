import { useState } from 'react'
import {
  Cloud,
  KeyRound,
  LogOut,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react'
import type { CloudStatus } from '../state/planner'
import type { UserRole } from '../data/profile'
import { signOut, updatePassword } from '../data/auth'
import { updateDisplayName } from '../data/profile'

interface Props {
  cloudStatus: CloudStatus
  userId: string | null
  userEmail: string | null
  displayName: string | null
  role: UserRole
  onDisplayNameChange: (value: string) => void
  onClose: () => void
}

export function AccountDialog({
  cloudStatus,
  userId,
  userEmail,
  displayName,
  role,
  onDisplayNameChange,
  onClose,
}: Props) {
  const [name, setName] = useState(displayName ?? '')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const clearMessages = () => {
    setNotice(null)
    setError(null)
  }

  const saveProfile = async () => {
    const normalized = name.trim()
    if (!userId || !normalized || busy) return

    setBusy(true)
    clearMessages()

    try {
      await updateDisplayName(userId, normalized)
      onDisplayNameChange(normalized)
      setNotice('Profil mis à jour.')
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossible de mettre à jour le profil.',
      )
    } finally {
      setBusy(false)
    }
  }

  const savePassword = async () => {
    if (busy) return

    if (password.length < 8) {
      setError(
        'Le mot de passe doit comporter au moins 8 caractères.',
      )
      return
    }

    if (password !== confirmation) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setBusy(true)
    clearMessages()

    try {
      await updatePassword(password)
      setPassword('')
      setConfirmation('')
      setNotice('Mot de passe enregistré.')
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossible de modifier le mot de passe.',
      )
    } finally {
      setBusy(false)
    }
  }

  const logout = async () => {
    setBusy(true)
    clearMessages()

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
        className="account-dialog account-dialog-wide"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="account-head">
          <div className="account-icon">
            <UserRound size={20}/>
          </div>
          <div>
            <h2>Mon compte</h2>
            <p>
              Identité, sécurité et synchronisation de votre espace Horizon.
            </p>
          </div>
          <button
            className="icon-button"
            aria-label="Fermer"
            onClick={onClose}
          >
            <X size={18}/>
          </button>
        </div>

        <div className="account-summary">
          <div>
            <span>Adresse e-mail</span>
            <strong>{userEmail ?? '—'}</strong>
          </div>
          <div>
            <span>Rôle</span>
            <strong className="role-chip">
              {role === 'admin' && <ShieldCheck size={14}/>}
              {role === 'admin'
                ? 'Administrateur'
                : 'Utilisateur'}
            </strong>
          </div>
          <div className={`cloud-state cloud-state-${cloudStatus}`}>
            <span className="cloud-state-dot"/>
            {cloudStatus === 'synced' && 'Synchronisé'}
            {cloudStatus === 'syncing' && 'Synchronisation…'}
            {cloudStatus === 'error' && 'Erreur de synchronisation'}
            {cloudStatus === 'local' && 'Local uniquement'}
          </div>
        </div>

        <div className="account-settings-grid">
          <section className="account-setting">
            <div className="account-setting-title">
              <UserRound size={17}/>
              <strong>Profil</strong>
            </div>
            <label>
              <span>Nom affiché</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <button
              className="btn primary"
              disabled={busy || !name.trim()}
              onClick={saveProfile}
            >
              Enregistrer
            </button>
          </section>

          <section className="account-setting">
            <div className="account-setting-title">
              <KeyRound size={17}/>
              <strong>Mot de passe</strong>
            </div>
            <label>
              <span>Nouveau mot de passe</span>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)}
              />
            </label>
            <label>
              <span>Confirmation</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) =>
                  setConfirmation(event.target.value)}
              />
            </label>
            <button
              className="btn secondary"
              disabled={busy || !password}
              onClick={savePassword}
            >
              Définir le mot de passe
            </button>
          </section>
        </div>

        <div className="account-footer">
          <div className="account-cloud-copy">
            <Cloud size={16}/>
            <span>
              Le cache local reste isolé par compte et synchronisé avec Supabase.
            </span>
          </div>
          <button
            className="account-signout"
            disabled={busy}
            onClick={logout}
          >
            <LogOut size={16}/>
            Se déconnecter
          </button>
        </div>

        {notice && (
          <p className="account-notice" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="planning-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  )
}
