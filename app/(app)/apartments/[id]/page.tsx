'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Copy, QrCode, Calendar, Sparkles, Package, MessageSquare, ExternalLink } from 'lucide-react'

interface AptDetail {
  apt: {
    id: string; name: string; address?: string; floor?: string
    access_code?: string; access_instructions?: string
    drive_link_photos?: string; expected_cleaning_min: number
    platforms: { slug: string; name: string; color: string; ical_url?: string }[]
  }
  reservations: Array<{
    id: string; guest_name?: string; checkin: string; checkout: string
    status: string; platform_slug?: string; platform_color?: string
  }>
  cleaning: Array<{
    id: string; planned_start: string; planned_duration_min?: number
    actual_duration_min?: number; status: string; cleaner_name?: string
    actual_start?: string; actual_end?: string
  }>
  consumables: Array<{ id: string; name: string; label: string; emoji: string; level: string }>
  qr: { token: string } | null
}

const TABS = [
  { key: 'calendrier', label: 'Calendrier', icon: Calendar },
  { key: 'menages',    label: 'Ménages',    icon: Sparkles },
  { key: 'stock',      label: 'Stock',      icon: Package },
  { key: 'qr',         label: 'QR Code',    icon: QrCode },
]

const PLAT_CLASS: Record<string, string> = { airbnb: 'plat-air', booking: 'plat-book', vrbo: 'plat-vrbo', leboncoin: 'plat-lbc' }
const PLAT_LETTER: Record<string, string> = { airbnb: 'A', booking: 'B', vrbo: 'V', leboncoin: 'L' }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
function fmtDur(min?: number) {
  if (!min) return '–'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h${m > 0 ? m.toString().padStart(2,'0') : ''}` : `${m}min`
}

export default function ApartmentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [data, setData] = useState<AptDetail | null>(null)
  const [tab, setTab] = useState('calendrier')
  const [loading, setLoading] = useState(true)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  useEffect(() => {
    fetch(`/api/apartments/${id}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [id])

  if (loading) {
    return (
      <div className="page-body" style={{ paddingTop: 40 }}>
        <div className="empty-state"><Sparkles size={32} /><h3>Chargement…</h3></div>
      </div>
    )
  }
  if (!data?.apt) {
    return (
      <div className="page-body" style={{ paddingTop: 40 }}>
        <div className="empty-state"><h3>Appartement introuvable.</h3></div>
      </div>
    )
  }

  const { apt, reservations, cleaning, consumables, qr } = data
  const qrUrl = qr ? `${appUrl}/pointage/${qr.token}` : null

  return (
    <>
      {/* Header with back */}
      <div className="page-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
        <button className="btn btn-ghost btn-sm" style={{ padding: '6px 0' }} onClick={() => router.push('/apartments')}>
          <ArrowLeft size={16} /> Appartements
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 12,
            background: 'linear-gradient(135deg, var(--slate-600) 0%, var(--blue) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
          }}>🏠</div>
          <div>
            <h1 style={{ fontSize: 22 }}>{apt.name}</h1>
            {apt.address && <div className="sub">{apt.address}</div>}
          </div>
        </div>
        {apt.platforms?.length > 0 && (
          <div style={{ display: 'flex', gap: 6 }}>
            {apt.platforms.map(p => (
              <span key={p.slug} className="plat-chip">
                <span className={`plat ${PLAT_CLASS[p.slug] ?? ''}`}>{PLAT_LETTER[p.slug] ?? p.slug[0].toUpperCase()}</span>
                {p.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mobile-topbar">
        <button className="btn btn-ghost btn-sm" onClick={() => router.push('/apartments')} style={{ padding: '6px 0' }}>
          <ArrowLeft size={16} /> {apt.name}
        </button>
      </div>

      <div className="page-body">
        {/* Tabs */}
        <div className="tabs">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} className={`tab-btn${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
              <Icon size={13} style={{ marginRight: 5 }} />
              {label}
            </button>
          ))}
        </div>

        {/* Calendrier tab */}
        {tab === 'calendrier' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--slate)' }}>Réservations ({reservations.length})</h3>
            </div>
            {reservations.length === 0 ? (
              <div className="empty-state"><Calendar size={32} /><h3>Aucune réservation</h3><p>Les réservations s'importent via iCal.</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {reservations.map(r => (
                  <div key={r.id} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    {r.platform_slug && (
                      <span className={`plat ${PLAT_CLASS[r.platform_slug] ?? ''}`}>
                        {PLAT_LETTER[r.platform_slug] ?? r.platform_slug[0]}
                      </span>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--slate)' }}>{r.guest_name ?? 'Voyageur'}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
                        {fmtDate(r.checkin)} → {fmtDate(r.checkout)}
                      </div>
                    </div>
                    <span className={`badge ${r.status === 'confirmed' ? 'badge-blue' : r.status === 'completed' ? 'badge-green' : 'badge-red'}`}>
                      {r.status === 'confirmed' ? 'Confirmé' : r.status === 'completed' ? 'Terminé' : 'Annulé'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* iCal links */}
            {apt.platforms?.filter(p => p.ical_url).length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Liens iCal connectés
                </h4>
                {apt.platforms.filter(p => p.ical_url).map(p => (
                  <div key={p.slug} className="card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span className={`plat ${PLAT_CLASS[p.slug] ?? ''}`}>{PLAT_LETTER[p.slug] ?? p.slug[0]}</span>
                    <span style={{ fontSize: 13, color: 'var(--ink-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.ical_url}</span>
                    <a href={p.ical_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ padding: '4px 6px' }}>
                      <ExternalLink size={13} />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Ménages tab */}
        {tab === 'menages' && (
          <div>
            {cleaning.length === 0 ? (
              <div className="empty-state"><Sparkles size={32} /><h3>Aucun ménage planifié</h3></div>
            ) : (
              cleaning.map(cs => {
                const isShort = cs.actual_duration_min !== null && cs.actual_duration_min !== undefined
                  && cs.planned_duration_min !== null && cs.planned_duration_min !== undefined
                  && cs.actual_duration_min < cs.planned_duration_min * 0.6
                return (
                  <div key={cs.id} className="cleaning-row">
                    <div className="cr-info">
                      <div className="cr-name">
                        {new Date(cs.planned_start).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}
                        {cs.cleaner_name ? ` · ${cs.cleaner_name}` : ''}
                      </div>
                      <div className="cr-meta">
                        Prévu: {fmtDur(cs.planned_duration_min ?? apt.expected_cleaning_min)}
                        {cs.actual_duration_min != null ? ` · Réel: ${fmtDur(cs.actual_duration_min)}` : ''}
                      </div>
                    </div>
                    <div className={`cr-dur ${isShort ? 'bad' : 'ok'}`}>
                      {cs.actual_duration_min != null ? fmtDur(cs.actual_duration_min) : '–'}
                    </div>
                    <span className={`badge ${
                      cs.status === 'completed' ? 'badge-green'
                      : cs.status === 'in_progress' ? 'badge-blue'
                      : cs.status === 'alert' ? 'badge-red'
                      : 'badge-gray'
                    }`}>
                      {cs.status === 'completed' ? 'Terminé'
                       : cs.status === 'in_progress' ? 'En cours'
                       : cs.status === 'alert' ? '⚠️ Alerte'
                       : 'Prévu'}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Stock tab */}
        {tab === 'stock' && (
          <div>
            {consumables.length === 0 ? (
              <div className="empty-state"><Package size={32} /><h3>Stock non initialisé</h3></div>
            ) : (
              <div className="stock-grid">
                {consumables.map(c => (
                  <div key={c.id} className="stock-item">
                    <div className="stock-emoji">{c.emoji}</div>
                    <div className="stock-name">{c.label}</div>
                    <div className="stock-bar">
                      <div className={`stock-fill ${c.level}`}></div>
                    </div>
                    <div className={`stock-level ${c.level}`}>
                      {c.level === 'full' ? 'Plein' : c.level === 'medium' ? 'Moyen' : c.level === 'low' ? 'Bas' : 'Vide'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* QR tab */}
        {tab === 'qr' && (
          <div>
            <div className="panel">
              <div className="panel-h"><h3>QR Code de pointage</h3></div>
              <div className="panel-b" style={{ textAlign: 'center' }}>
                {qr ? (
                  <>
                    <p style={{ fontSize: 13.5, color: 'var(--ink-2)', marginBottom: 20 }}>
                      Imprimez ce QR code et collez-le dans l'appartement.<br />
                      Vos prestataires scannent pour pointer leur arrivée et leur départ.
                    </p>
                    <div style={{
                      display: 'inline-block', padding: 20, background: '#fff',
                      border: '1px solid var(--line)', borderRadius: 12, marginBottom: 20,
                    }}>
                      {/* QR placeholder visuel */}
                      <div style={{
                        width: 160, height: 160,
                        background: 'repeating-linear-gradient(0deg, #1E2D40 0px, #1E2D40 8px, #fff 8px, #fff 16px), repeating-linear-gradient(90deg, #1E2D40 0px, #1E2D40 8px, #fff 8px, #fff 16px)',
                        borderRadius: 4,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 24,
                      }}>
                        <div style={{ background: '#fff', padding: 8, borderRadius: 6 }}>⚡</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary" onClick={() => { if (qrUrl) navigator.clipboard.writeText(qrUrl) }}>
                        <Copy size={14} /> Copier le lien
                      </button>
                      {qrUrl && (
                        <a href={qrUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                          <ExternalLink size={14} /> Ouvrir la page
                        </a>
                      )}
                    </div>
                    {qrUrl && (
                      <div style={{ marginTop: 16, fontSize: 12, color: 'var(--ink-3)', wordBreak: 'break-all' }}>
                        {qrUrl}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="empty-state">
                    <QrCode size={32} />
                    <h3>QR Code non généré</h3>
                    <p>Rechargez la page ou contactez le support.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Accès */}
            {(apt.access_code || apt.access_instructions || apt.drive_link_photos) && (
              <div className="panel" style={{ marginTop: 20 }}>
                <div className="panel-h"><h3>Informations d'accès</h3></div>
                <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {apt.floor && (
                    <div><span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>ÉTAGE</span><div style={{ fontSize: 14, color: 'var(--slate)', marginTop: 2 }}>{apt.floor}</div></div>
                  )}
                  {apt.access_code && (
                    <div><span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>CODE D'ACCÈS</span><div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: 'var(--blue)', marginTop: 2 }}>{apt.access_code}</div></div>
                  )}
                  {apt.access_instructions && (
                    <div><span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>INSTRUCTIONS</span><div style={{ fontSize: 13.5, color: 'var(--ink-2)', marginTop: 2 }}>{apt.access_instructions}</div></div>
                  )}
                  {apt.drive_link_photos && (
                    <a href={apt.drive_link_photos} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                      <ExternalLink size={14} /> Voir les photos d'accès
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
