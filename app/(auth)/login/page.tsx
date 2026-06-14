'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
    const body: Record<string, string> = { email, password }
    if (mode === 'register') body.name = name

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Erreur inconnue')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1E2D40 0%, #2C405A 100%)',
      padding: '24px',
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 400, padding: '36px 32px' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <Logo size={28} />
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--slate)', letterSpacing: '-.02em' }}>Concio</span>
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--slate)', marginBottom: 6 }}>
          {mode === 'login' ? 'Connexion à votre espace' : 'Créer votre compte'}
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-2)', marginBottom: 24 }}>
          {mode === 'login'
            ? 'Gérez vos locations courte durée avec Concio.'
            : 'Démarrez votre essai gratuit dès maintenant.'}
        </p>

        <form onSubmit={submit}>
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">Votre nom / raison sociale</label>
              <input
                className="form-input"
                type="text"
                placeholder="Marie Dupont"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Adresse email</label>
            <input
              className="form-input"
              type="email"
              placeholder="vous@exemple.fr"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mot de passe</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="alert-card danger" style={{ marginBottom: 14, fontSize: 13 }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary btn-lg btn-full" type="submit" disabled={loading}>
            {loading ? 'Chargement…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13.5, color: 'var(--ink-2)' }}>
          {mode === 'login' ? (
            <>Pas encore de compte ?{' '}
              <button className="link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => setMode('register')}>
                S'inscrire
              </button>
            </>
          ) : (
            <>Déjà un compte ?{' '}
              <button className="link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => setMode('login')}>
                Se connecter
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
