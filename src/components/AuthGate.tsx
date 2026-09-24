import { useState } from 'react'
import { ArrowRight, LockKeyhole, Mail } from 'lucide-react'
import type { AuthStatus } from '../state/planner'
import { sendMagicLink } from '../data/auth'
import { supabaseConfigured } from '../lib/supabase'

interface Props {
  status: AuthStatus
}

export function AuthGate({ status }: Props) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'loading') {
    return (
      <main className="auth-gate auth-loading" aria-live="polite">
        <div className="auth-brand">Horizon</div>
        <div className="auth-loader" aria-hidden="true"/>
        <p>Vérification de ta session…</p>
      </main>
    )
  }

  const submit = async () => {
    const normalizedEmail = email.trim()
    if (!normalizedEmail || busy) return

    setBusy(true)
    setError(null)

    try {
      await sendMagicLink(normalizedEmail)
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

  return (
    <main className="auth-gate">
      <section className="auth-card">
        <div className="auth-brand">Horizon</div>

        <div className="auth-lock">
          <LockKeyhole size={22}/>
        </div>

        <h1>Ton planning reste privé.</h1>
        <p className="auth-copy">
          Connecte-toi pour accéder à ton calendrier, tes tâches et ta
          synchronisation. Aucun contenu du planning n’est affiché avant
          authentification.
        </p>

        {!supabaseConfigured ? (
          <div className="auth-error">
            La connexion cloud n’est pas configurée. L’accès au planning reste
            verrouillé par sécurité.
          </div>
        ) : sent ? (
          <div className="auth-sent" role="status">
            <Mail size={22}/>
            <strong>Consulte ta boîte mail</strong>
            <span>Un lien de connexion a été envoyé à {email.trim()}.</span>
            <button
              type="button"
              onClick={() => setSent(false)}
            >
              Utiliser une autre adresse
            </button>
          </div>
        ) : (
          <div className="auth-form">
            <label htmlFor="horizon-email">Adresse e-mail</label>
            <div className="auth-input-row">
              <input
                id="horizon-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="toi@exemple.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submit()
                }}
              />
              <button
                type="button"
                aria-label="Recevoir un lien magique"
                disabled={busy || !email.trim()}
                onClick={submit}
              >
                <ArrowRight size={19}/>
              </button>
            </div>
            <span className="auth-hint">
              Aucun mot de passe : Horizon t’envoie un lien magique à usage
              unique.
            </span>
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
