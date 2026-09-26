import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  LockKeyhole,
  Mail,
  UserPlus,
} from 'lucide-react'
import type { AuthStatus } from '../state/planner'
import {
  requestPasswordReset,
  signInWithPassword,
  signUpWithPassword,
  updatePassword,
} from '../data/auth'
import { supabaseConfigured } from '../lib/supabase'

type Mode = 'login' | 'signup' | 'forgot'

interface Props {
  status: AuthStatus
}

function messageFromError(cause: unknown) {
  if (!(cause instanceof Error)) {
    return 'Une erreur est survenue.'
  }

  const message = cause.message.toLowerCase()

  if (message.includes('invalid login credentials')) {
    return 'Adresse e-mail ou mot de passe incorrect.'
  }

  if (message.includes('email not confirmed')) {
    return 'Votre adresse e-mail doit encore être confirmée.'
  }

  return cause.message
}

export function AuthGate({ status }: Props) {
  const [mode, setMode] = useState<Mode>('login')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (status === 'loading') {
    return (
      <main className="auth-gate auth-loading" aria-live="polite">
        <div className="auth-brand">Horizon</div>
        <div className="auth-loader" aria-hidden="true"/>
        <p>Vérification de votre session…</p>
      </main>
    )
  }

  const resetMessages = () => {
    setNotice(null)
    setError(null)
  }

  const changeMode = (next: Mode) => {
    resetMessages()
    setMode(next)
  }

  const submitLogin = async () => {
    if (!email.trim() || !password || busy) return

    setBusy(true)
    resetMessages()

    try {
      await signInWithPassword(email.trim(), password)
    } catch (cause) {
      setError(messageFromError(cause))
    } finally {
      setBusy(false)
    }
  }

  const submitSignup = async () => {
    if (busy) return

    const name = displayName.trim()
    const normalizedEmail = email.trim()

    if (!name || !normalizedEmail) {
      setError('Nom et adresse e-mail requis.')
      return
    }

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
    resetMessages()

    try {
      const result = await signUpWithPassword({
        displayName: name,
        email: normalizedEmail,
        password,
      })

      if (result.requiresEmailConfirmation) {
        setNotice(
          'Compte créé. Consultez votre messagerie afin de confirmer votre adresse e-mail.',
        )
      }
    } catch (cause) {
      setError(messageFromError(cause))
    } finally {
      setBusy(false)
    }
  }

  const submitForgot = async () => {
    if (!email.trim() || busy) return

    setBusy(true)
    resetMessages()

    try {
      await requestPasswordReset(email.trim())
      setNotice(
        'Un lien de réinitialisation du mot de passe vient de vous être envoyé.',
      )
    } catch (cause) {
      setError(messageFromError(cause))
    } finally {
      setBusy(false)
    }
  }

  const submitRecovery = async () => {
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
    resetMessages()

    try {
      await updatePassword(password)
      window.location.replace(window.location.origin)
    } catch (cause) {
      setError(messageFromError(cause))
      setBusy(false)
    }
  }

  if (status === 'recovery') {
    return (
      <main className="auth-gate">
        <section className="auth-card">
          <div className="auth-brand">Horizon</div>
          <div className="auth-lock">
            <LockKeyhole size={22}/>
          </div>
          <h1>Nouveau mot de passe</h1>
          <p className="auth-copy">
            Choisissez un nouveau mot de passe pour votre compte.
          </p>

          <div className="auth-form auth-form-stack">
            <label htmlFor="recovery-password">
              Nouveau mot de passe
            </label>
            <input
              id="recovery-password"
              className="auth-field"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            <label htmlFor="recovery-confirmation">
              Confirmer le mot de passe
            </label>
            <input
              id="recovery-confirmation"
              className="auth-field"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitRecovery()
              }}
            />

            <button
              type="button"
              className="auth-primary"
              disabled={busy}
              onClick={submitRecovery}
            >
              {busy ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
            </button>
          </div>

          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}
        </section>
      </main>
    )
  }

  return (
    <main className="auth-gate">
      <section className="auth-card auth-card-wide">
        <div className="auth-brand">Horizon</div>

        <div className="auth-lock">
          {mode === 'signup'
            ? <UserPlus size={22}/>
            : <LockKeyhole size={22}/>}
        </div>

        <h1>
          {mode === 'login' && 'Connexion'}
          {mode === 'signup' && 'Créer un compte'}
          {mode === 'forgot' && 'Mot de passe oublié'}
        </h1>

        <p className="auth-copy">
          {mode === 'login' &&
            'Accédez à votre espace personnel Horizon avec votre adresse e-mail et votre mot de passe.'}
          {mode === 'signup' &&
            'Créez votre espace personnel. Vos données restent isolées de celles des autres utilisateurs.'}
          {mode === 'forgot' &&
            'Saisissez votre adresse e-mail pour définir un nouveau mot de passe.'}
        </p>

        {!supabaseConfigured ? (
          <div className="auth-error">
            La connexion cloud n’est pas configurée. L’accès au planning reste verrouillé.
          </div>
        ) : (
          <>
            {mode !== 'forgot' && (
              <div className="auth-tabs">
                <button
                  type="button"
                  className={mode === 'login' ? 'active' : ''}
                  onClick={() => changeMode('login')}
                >
                  Connexion
                </button>
                <button
                  type="button"
                  className={mode === 'signup' ? 'active' : ''}
                  onClick={() => changeMode('signup')}
                >
                  Créer un compte
                </button>
              </div>
            )}

            <div className="auth-form auth-form-stack">
              {mode === 'signup' && (
                <>
                  <label htmlFor="horizon-name">
                    Nom affiché
                  </label>
                  <input
                    id="horizon-name"
                    className="auth-field"
                    type="text"
                    autoComplete="name"
                    placeholder="Votre nom"
                    value={displayName}
                    onChange={(event) =>
                      setDisplayName(event.target.value)}
                  />
                </>
              )}

              <label htmlFor="horizon-email">
                Adresse e-mail
              </label>
              <input
                id="horizon-email"
                className="auth-field"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="vous@exemple.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />

              {mode !== 'forgot' && (
                <>
                  <label htmlFor="horizon-password">
                    Mot de passe
                  </label>
                  <input
                    id="horizon-password"
                    className="auth-field"
                    type="password"
                    autoComplete={
                      mode === 'login'
                        ? 'current-password'
                        : 'new-password'
                    }
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)}
                  />
                </>
              )}

              {mode === 'signup' && (
                <>
                  <label htmlFor="horizon-confirmation">
                    Confirmer le mot de passe
                  </label>
                  <input
                    id="horizon-confirmation"
                    className="auth-field"
                    type="password"
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(event) =>
                      setConfirmation(event.target.value)}
                  />
                </>
              )}

              {mode === 'login' && (
                <button
                  type="button"
                  className="auth-text-button"
                  onClick={() => changeMode('forgot')}
                >
                  Mot de passe oublié ?
                </button>
              )}

              {mode === 'forgot' && (
                <button
                  type="button"
                  className="auth-back-button"
                  onClick={() => changeMode('login')}
                >
                  <ArrowLeft size={16}/>
                  Retour à la connexion
                </button>
              )}

              <button
                type="button"
                className="auth-primary"
                disabled={busy}
                onClick={
                  mode === 'login'
                    ? submitLogin
                    : mode === 'signup'
                      ? submitSignup
                      : submitForgot
                }
              >
                {busy
                  ? 'Veuillez patienter…'
                  : mode === 'login'
                    ? 'Se connecter'
                    : mode === 'signup'
                      ? 'Créer mon compte'
                      : 'Envoyer le lien de réinitialisation'}
                {!busy && mode !== 'forgot' && (
                  <ArrowRight size={18}/>
                )}
                {!busy && mode === 'forgot' && (
                  <Mail size={18}/>
                )}
              </button>
            </div>
          </>
        )}

        {notice && (
          <div className="auth-notice" role="status">
            {notice}
          </div>
        )}

        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}
      </section>
    </main>
  )
}
