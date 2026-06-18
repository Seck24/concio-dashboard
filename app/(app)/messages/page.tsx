'use client'

import { useEffect, useState } from 'react'
import { Bot, Copy, Check, Sparkles, Calendar, X } from 'lucide-react'

const PLAT_CLASS: Record<string, string> = { airbnb: 'plat-air', booking: 'plat-book', vrbo: 'plat-vrbo', leboncoin: 'plat-lbc' }
const PLAT_LETTER: Record<string, string> = { airbnb: 'A', booking: 'B', vrbo: 'V', leboncoin: 'L' }

interface Reservation {
  id: string
  guest_name?: string
  checkin: string
  checkout: string
  status: string
  platform_slug?: string
  apartment_id: string
  apartment_name: string
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysUntil(iso: string) {
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
  if (diff === 0) return "Aujourd'hui"
  if (diff === 1) return 'Demain'
  return `Dans ${diff} j`
}

export default function MessagesPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)

  const [generating, setGenerating] = useState<string | null>(null)
  const [modal, setModal] = useState<{ reservationId: string; guestName: string; message: string } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/ai/upcoming')
      .then(r => r.json())
      .then(d => { setReservations(Array.isArray(d) ? d : []); setLoading(false) })
  }, [])

  async function generate(r: Reservation) {
    setGenerating(r.id)
    try {
      const res = await fetch('/api/ai/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservation_id: r.id }),
      })
      const data = await res.json()
      if (res.ok && data.message) {
        setModal({ reservationId: r.id, guestName: r.guest_name ?? 'Voyageur', message: data.message })
      }
    } finally {
      setGenerating(null)
    }
  }

  function copyMessage() {
    if (!modal) return
    navigator.clipboard.writeText(modal.message).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Agent IA</h1>
          <div className="sub">Messages de bienvenue personnalisés pour vos voyageurs</div>
        </div>
      </div>
      <div className="mobile-topbar">
        <div><h1>Agent IA</h1></div>
      </div>

      <div className="page-body">
        {loading ? (
          <div className="empty-state"><Bot size={32} /><h3>Chargement…</h3></div>
        ) : reservations.length === 0 ? (
          <div className="empty-state">
            <Calendar size={42} />
            <h3>Aucune arrivée dans les 30 prochains jours</h3>
            <p>Les réservations confirmées à venir apparaissent ici. Synchronisez vos calendriers iCal dans la section Appartements.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 4 }}>
              {reservations.length} arrivée{reservations.length > 1 ? 's' : ''} prévue{reservations.length > 1 ? 's' : ''} dans les 30 prochains jours
            </div>
            {reservations.map(r => {
              const nights = Math.round(
                (new Date(r.checkout).getTime() - new Date(r.checkin).getTime()) / 86400000
              )
              return (
                <div key={r.id} className="card" style={{
                  padding: '16px 18px',
                  display: 'flex', alignItems: 'center', gap: 16,
                  flexWrap: 'wrap',
                }}>
                  {/* Platform badge */}
                  {r.platform_slug ? (
                    <span className={`plat ${PLAT_CLASS[r.platform_slug] ?? ''}`} style={{ flexShrink: 0 }}>
                      {PLAT_LETTER[r.platform_slug] ?? r.platform_slug[0].toUpperCase()}
                    </span>
                  ) : (
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, background: 'var(--blue-50)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Calendar size={15} style={{ color: 'var(--blue)' }} />
                    </div>
                  )}

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--slate)' }}>
                      {r.guest_name ?? 'Voyageur'}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 2 }}>
                      {r.apartment_name} · {fmtDate(r.checkin)} → {fmtDate(r.checkout)} · {nights} nuit{nights > 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Countdown */}
                  <span className="badge badge-blue" style={{ flexShrink: 0 }}>
                    {daysUntil(r.checkin)}
                  </span>

                  {/* Generate button */}
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ flexShrink: 0, gap: 6 }}
                    disabled={generating === r.id}
                    onClick={() => generate(r)}
                  >
                    {generating === r.id ? (
                      <>
                        <Sparkles size={14} style={{ animation: 'spin 1s linear infinite' }} />
                        Génération…
                      </>
                    ) : (
                      <>
                        <Bot size={14} />
                        Générer
                      </>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px 16px',
          }}
          onClick={e => { if (e.target === e.currentTarget) setModal(null) }}
        >
          <div style={{
            background: 'var(--surface)', borderRadius: 16,
            width: '100%', maxWidth: 560,
            boxShadow: '0 20px 60px rgba(0,0,0,.2)',
            display: 'flex', flexDirection: 'column', maxHeight: '85dvh',
          }}>
            {/* Modal header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 20px', borderBottom: '1px solid var(--line)',
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--slate)' }}>
                  Message pour {modal.guestName}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                  Généré par l'agent IA — modifiez librement avant d'envoyer
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" style={{ padding: 6 }} onClick={() => setModal(null)}>
                <X size={18} />
              </button>
            </div>

            {/* Message textarea */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
              <textarea
                className="form-input"
                rows={14}
                style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, fontSize: 13.5 }}
                value={modal.message}
                onChange={e => setModal(p => p ? { ...p, message: e.target.value } : null)}
              />
            </div>

            {/* Modal footer */}
            <div style={{
              padding: '14px 20px', borderTop: '1px solid var(--line)',
              display: 'flex', gap: 10, justifyContent: 'flex-end',
            }}>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>
                Fermer
              </button>
              <button className="btn btn-primary" onClick={copyMessage}>
                {copied ? <><Check size={15} /> Copié !</> : <><Copy size={15} /> Copier le message</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </>
  )
}
