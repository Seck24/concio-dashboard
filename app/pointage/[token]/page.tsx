'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Logo from '@/components/Logo'

type State = 'loading' | 'arrived' | 'departed' | 'already_done' | 'error'

function fmtDur(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h${m > 0 ? m.toString().padStart(2, '0') : ''}` : `${m} min`
}

export default function PointagePage() {
  const params = useParams()
  const token = params.token as string

  const [state, setState] = useState<State>('loading')
  const [aptName, setAptName] = useState('')
  const [heure, setHeure] = useState('')
  const [duration, setDuration] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function autoRecord() {
      // 1. Check current status
      const statusRes = await fetch(`/api/pointage/${token}`)
      if (!statusRes.ok) {
        const d = await statusRes.json().catch(() => ({}))
        setErrorMsg(d.error ?? 'QR code invalide.')
        setState('error')
        return
      }
      const status = await statusRes.json()
      setAptName(status.apartment_name ?? '')

      // Already completed today → show info, nothing to record
      if (status.cleaning_status === 'completed') {
        setState('already_done')
        return
      }

      // Determine action: in_progress with arrivee → depart, otherwise → arrivee
      const isInProgress = status.cleaning_status === 'in_progress' && status.arrivee_heure
      const action = isInProgress ? 'depart' : 'arrivee'

      // 2. Auto-record
      const postRes = await fetch(`/api/pointage/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: action }),
      })

      if (!postRes.ok) {
        const d = await postRes.json().catch(() => ({}))
        setErrorMsg(d.error ?? 'Erreur lors de l\'enregistrement.')
        setState('error')
        return
      }

      const postData = await postRes.json()
      const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      setHeure(now)

      if (action === 'arrivee') {
        setState('arrived')
      } else {
        if (postData.actual_min != null) setDuration(fmtDur(postData.actual_min))
        setState('departed')
      }
    }

    autoRecord()
  }, [token])

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
      textAlign: 'center',
    }}>
      {/* Logo */}
      <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Logo size={20} />
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1E2D40' }}>Concio</span>
      </div>

      {/* LOADING */}
      {state === 'loading' && (
        <div style={{ color: '#93A1B3' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: '#1E2D40' }}>Enregistrement…</div>
        </div>
      )}

      {/* ARRIVÉE */}
      {state === 'arrived' && (
        <div style={{ width: '100%', maxWidth: 340 }}>
          <div style={{
            width: 100, height: 100, borderRadius: '50%',
            background: '#ECFDF5', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 24px', fontSize: 52,
            animation: 'pop .35s ease-out',
          }}>✅</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
            Arrivée enregistrée
          </div>
          <div style={{ fontSize: 52, fontWeight: 700, color: '#1E2D40', letterSpacing: '-.03em', lineHeight: 1, marginBottom: 12 }}>
            {heure}
          </div>
          {aptName && (
            <div style={{ fontSize: 16, color: '#5A6B81', marginBottom: 4 }}>{aptName}</div>
          )}
          <div style={{ marginTop: 28, fontSize: 14, color: '#93A1B3' }}>
            Rescannez le QR code quand vous avez terminé.
          </div>
        </div>
      )}

      {/* DÉPART */}
      {state === 'departed' && (
        <div style={{ width: '100%', maxWidth: 340 }}>
          <div style={{
            width: 100, height: 100, borderRadius: '50%',
            background: '#ECFDF5', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 24px', fontSize: 52,
            animation: 'pop .35s ease-out',
          }}>✅</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
            Départ enregistré
          </div>
          <div style={{ fontSize: 52, fontWeight: 700, color: '#1E2D40', letterSpacing: '-.03em', lineHeight: 1, marginBottom: 12 }}>
            {heure}
          </div>
          {duration && (
            <div style={{
              display: 'inline-block', background: '#F0F9FF', border: '1px solid #BAE6FD',
              borderRadius: 10, padding: '8px 20px', fontSize: 17, fontWeight: 700, color: '#0284C7', marginBottom: 12,
            }}>
              Durée : {duration}
            </div>
          )}
          {aptName && (
            <div style={{ fontSize: 15, color: '#5A6B81' }}>{aptName}</div>
          )}
          <div style={{ marginTop: 28, fontSize: 16, color: '#10B981', fontWeight: 600 }}>
            Beau travail 👍
          </div>
        </div>
      )}

      {/* DÉJÀ POINTÉ */}
      {state === 'already_done' && (
        <div style={{ width: '100%', maxWidth: 320 }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>☑️</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1E2D40', marginBottom: 10 }}>
            Passage déjà enregistré
          </h2>
          <p style={{ fontSize: 14, color: '#5A6B81' }}>
            {aptName && <><strong>{aptName}</strong> — </>}
            Le ménage d'aujourd'hui a déjà été complété.
          </p>
        </div>
      )}

      {/* ERREUR */}
      {state === 'error' && (
        <div style={{ width: '100%', maxWidth: 320 }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>❌</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1E2D40', marginBottom: 10 }}>Erreur</h2>
          <p style={{ fontSize: 14, color: '#5A6B81' }}>{errorMsg}</p>
        </div>
      )}

      <style>{`
        @keyframes pop {
          0%   { transform: scale(.4); opacity: 0; }
          70%  { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
