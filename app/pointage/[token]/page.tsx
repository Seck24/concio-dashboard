'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Logo from '@/components/Logo'

type State = 'loading' | 'error' | 'idle' | 'clocked_in' | 'done'

interface AptInfo {
  apartment_name: string
  expected_cleaning_min: number
  cleaning_session_id?: string
  cleaning_status?: string
  arrivee_heure?: string
}

function fmtDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h${m > 0 ? m.toString().padStart(2,'0') : ''}` : `${m} min`
}

function LiveElapsed({ since }: { since: string }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const start = new Date(since).getTime()
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 60000))
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [since])
  return <>{fmtDuration(elapsed)}</>
}

export default function PointagePage() {
  const params = useParams()
  const token = params.token as string

  const [state, setState] = useState<State>('loading')
  const [apt, setApt] = useState<AptInfo | null>(null)
  const [error, setError] = useState('')
  const [actualMin, setActualMin] = useState<number | null>(null)
  const [working, setWorking] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/pointage/${token}`)
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'QR code invalide.')
      setState('error')
      return
    }
    const d: AptInfo = await res.json()
    setApt(d)

    if (d.cleaning_status === 'in_progress' && d.arrivee_heure) {
      setState('clocked_in')
    } else {
      setState('idle')
    }
  }, [token])

  useEffect(() => { load() }, [load])

  async function clockIn() {
    setWorking(true)
    const res = await fetch(`/api/pointage/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'arrivee' }),
    })
    if (res.ok) {
      await load()
      setState('clocked_in')
    }
    setWorking(false)
  }

  async function clockOut() {
    setWorking(true)
    const res = await fetch(`/api/pointage/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'depart' }),
    })
    if (res.ok) {
      const d = await res.json()
      setActualMin(d.actual_min)
      setState('done')
    }
    setWorking(false)
  }

  const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#F9FAFB',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 20px',
      fontFamily: '"Inter", -apple-system, sans-serif',
    }}>
      {/* Logo */}
      <div style={{ position: 'absolute', top: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Logo size={20} />
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1E2D40' }}>Concio</span>
      </div>

      {/* LOADING */}
      {state === 'loading' && (
        <div style={{ textAlign: 'center', color: '#93A1B3', fontSize: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
          Chargement…
        </div>
      )}

      {/* ERROR */}
      {state === 'error' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>❌</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1E2D40', marginBottom: 10 }}>QR Code invalide</h2>
          <p style={{ fontSize: 14, color: '#5A6B81' }}>{error}</p>
        </div>
      )}

      {/* STATE A — idle (not clocked in) */}
      {(state === 'idle' || state === 'clocked_in') && apt && (
        <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
          {/* Apartment name */}
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1E2D40', letterSpacing: '-.02em', marginBottom: 8 }}>
            {apt.apartment_name}
          </div>

          {/* Live clock */}
          <div style={{ fontSize: 52, fontWeight: 300, color: '#3B82F6', letterSpacing: '-.03em', marginBottom: 32 }}>
            {now}
          </div>

          {state === 'idle' && (
            <>
              <button
                onClick={clockIn}
                disabled={working}
                style={{
                  width: '100%',
                  height: 80,
                  borderRadius: 14,
                  background: working ? '#9CA3AF' : '#10B981',
                  color: '#fff',
                  fontSize: 20,
                  fontWeight: 700,
                  border: 'none',
                  cursor: working ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 20px rgba(16,185,129,.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  transition: 'opacity .2s',
                  marginBottom: 12,
                }}
              >
                {working ? '⏳ Enregistrement…' : '✓ Je commence le ménage'}
              </button>
              <p style={{ fontSize: 13.5, color: '#93A1B3' }}>
                Appuie pour enregistrer ton heure d'arrivée
              </p>
            </>
          )}

          {state === 'clocked_in' && apt.arrivee_heure && (
            <>
              {/* Progress bar green */}
              <div style={{
                background: '#ECFDF5',
                border: '1px solid #A7F3D0',
                borderRadius: 12,
                padding: '14px 18px',
                marginBottom: 28,
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}>
                <span style={{ fontSize: 22 }}>🟢</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#065F46', fontSize: 15 }}>En cours</div>
                  <div style={{ fontSize: 13, color: '#059669', marginTop: 2 }}>
                    Depuis <LiveElapsed since={apt.arrivee_heure} />
                    {apt.expected_cleaning_min && ` · prévu ${fmtDuration(apt.expected_cleaning_min)}`}
                  </div>
                </div>
              </div>

              <button
                onClick={clockOut}
                disabled={working}
                style={{
                  width: '100%',
                  height: 80,
                  borderRadius: 14,
                  background: working ? '#9CA3AF' : '#EF4444',
                  color: '#fff',
                  fontSize: 20,
                  fontWeight: 700,
                  border: 'none',
                  cursor: working ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 20px rgba(239,68,68,.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  transition: 'opacity .2s',
                  marginBottom: 12,
                }}
              >
                {working ? '⏳ Enregistrement…' : '✓ J\'ai terminé'}
              </button>
              <p style={{ fontSize: 13.5, color: '#93A1B3' }}>
                Appuie pour enregistrer ton heure de départ
              </p>
            </>
          )}
        </div>
      )}

      {/* STATE C — done */}
      {state === 'done' && (
        <div style={{ textAlign: 'center', width: '100%', maxWidth: 320 }}>
          {/* Animated checkmark */}
          <div style={{
            width: 96, height: 96, borderRadius: '50%',
            background: '#ECFDF5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
            fontSize: 48,
            animation: 'pop .4s ease-out',
          }}>
            ✅
          </div>

          <h2 style={{ fontSize: 26, fontWeight: 700, color: '#1E2D40', marginBottom: 10 }}>
            Terminé !
          </h2>

          {actualMin != null && (
            <p style={{ fontSize: 18, color: '#5A6B81', marginBottom: 8 }}>
              Durée : <strong style={{ color: '#1E2D40' }}>{fmtDuration(actualMin)}</strong>
            </p>
          )}

          <p style={{ fontSize: 15, color: '#10B981', fontWeight: 600, marginBottom: 32 }}>
            Beau travail 👍
          </p>

          <p style={{ fontSize: 13, color: '#93A1B3' }}>
            Cette page se fermera automatiquement.
          </p>
        </div>
      )}

      <style>{`
        @keyframes pop {
          0%   { transform: scale(.5); opacity: 0; }
          70%  { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
