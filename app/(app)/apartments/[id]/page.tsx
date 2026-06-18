'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Copy, QrCode, Calendar, Sparkles, Package, BookOpen, Bot, ExternalLink, Download, Send, Phone, Save } from 'lucide-react'
import QRCodeLib from 'qrcode'

interface AptDetail {
  apt: {
    id: string; name: string; address?: string; floor?: string
    access_code?: string; access_instructions?: string
    drive_link_photos?: string; expected_cleaning_min: number
    city_info?: string; activities_nearby?: string; parking_tips?: string
    platforms: { slug: string; name: string; color: string; ical_url?: string }[]
  }
  reservations: Array<{
    id: string; guest_name?: string; guest_phone?: string; checkin: string; checkout: string
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
  { key: 'carnet',     label: 'Carnet',      icon: BookOpen },
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
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  // Agent IA state
  const [phones, setPhones] = useState<Record<string, string>>({})
  const [startingConv, setStartingConv] = useState<string | null>(null)
  const [carnetAppt, setCarnetAppt] = useState('')
  const [savingCarnet, setSavingCarnet] = useState(false)

  useEffect(() => {
    fetch(`/api/apartments/${id}`)
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLoading(false)
        if (d.apt) {
          setCarnetAppt(d.apt.carnet_appartement ?? '')
          // Pre-fill phone numbers from existing reservations
          const p: Record<string, string> = {}
          for (const r of (d.reservations ?? [])) {
            if (r.guest_phone) p[r.id] = r.guest_phone
          }
          setPhones(p)
        }
      })
  }, [id])

  useEffect(() => {
    if (tab === 'qr' && data?.qr) {
      const url = `${appUrl}/pointage/${data.qr.token}`
      QRCodeLib.toDataURL(url, { width: 220, margin: 2, color: { dark: '#1E2D40', light: '#ffffff' } })
        .then(setQrDataUrl)
    }
  }, [tab, data, appUrl])

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

  async function savePhone(resvId: string) {
    const phone = phones[resvId]
    if (!phone) return
    await fetch(`/api/reservations/${resvId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guest_phone: phone }),
    })
  }

  async function startConversation(resvId: string) {
    const phone = phones[resvId]
    if (!phone) return
    setStartingConv(resvId)
    try {
      await savePhone(resvId)
      const res = await fetch('/api/agent/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservation_id: resvId }),
      })
      const data = await res.json()
      if (res.ok && data.conversation_id) {
        router.push(`/messages/${data.conversation_id}`)
      }
    } finally {
      setStartingConv(null)
    }
  }

  async function saveCarnet() {
    setSavingCarnet(true)
    await fetch(`/api/apartments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carnet_appartement: carnetAppt }),
    })
    setSavingCarnet(false)
  }

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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {reservations.map(r => (
                  <div key={r.id} className="card" style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
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
                    {r.status === 'confirmed' && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <Phone size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }} />
                          <input
                            className="form-input"
                            style={{ paddingLeft: 30, fontSize: 13, height: 34 }}
                            placeholder="+225 07 00 00 00 00"
                            value={phones[r.id] ?? ''}
                            onChange={e => setPhones(p => ({ ...p, [r.id]: e.target.value }))}
                          />
                        </div>
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ flexShrink: 0, gap: 5, fontSize: 12.5 }}
                          disabled={!phones[r.id] || startingConv === r.id}
                          onClick={() => startConversation(r.id)}
                        >
                          {startingConv === r.id ? '…' : <><Bot size={12} /> Préparer message</>}
                        </button>
                      </div>
                    )}
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

        {/* Carnet de bord tab */}
        {tab === 'carnet' && (
          <div style={{ maxWidth: 640 }}>
            <div className="panel">
              <div className="panel-h" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <BookOpen size={17} style={{ color: 'var(--blue)' }} />
                <h3>Carnet de bord — {apt.name}</h3>
              </div>
              <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: 0, lineHeight: 1.6 }}>
                  Écrivez tout ce que votre agent doit savoir sur ce logement : accès, code, parking, WiFi, activités proches, conseils arrivée tardive ou départ, photos d'indication, règles spécifiques, liens utiles…
                  <br /><br />
                  Pas besoin de structure. L'agent comprend du texte libre.
                </p>
                <textarea
                  className="form-input"
                  rows={16}
                  style={{ resize: 'vertical', lineHeight: 1.65, fontSize: 13.5 }}
                  placeholder={`Exemple :

Accès : Sonner au 3ème interphone "Dupont". Code porte entrée : A1234.
Photos d'accès : https://drive.google.com/...
Parking : Gratuit dans la rue après 18h. Parking payant à 200m (Centre Commercial).
WiFi : ConcioNet / motdepasse123

Arrivée tardive : Possible jusqu'à 23h, prévenir 2h avant.
Départ : Laisser les clés sur la table de la cuisine. Poubelles à sortir.

Activités proches :
- Restaurant Chez Koffi (5 min à pied, très bon attiéké)
- Marché de Cocody (10 min voiture, fermé le lundi)
- Plage de Grand-Bassam (45 min, accès A100)

Conseils : Eviter la rue Nationale entre 7h-9h et 17h-19h (embouteillages).`}
                  value={carnetAppt}
                  onChange={e => setCarnetAppt(e.target.value)}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={saveCarnet} disabled={savingCarnet}>
                    <Save size={15} /> {savingCarnet ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            </div>
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
                      {qrDataUrl
                        ? <img src={qrDataUrl} alt="QR Code pointage" width={220} height={220} style={{ display: 'block' }} />
                        : <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)' }}>Génération…</div>
                      }
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary" onClick={() => { if (qrUrl) navigator.clipboard.writeText(qrUrl) }}>
                        <Copy size={14} /> Copier le lien
                      </button>
                      {qrDataUrl && (
                        <a href={qrDataUrl} download={`qr-${apt.name}.png`} className="btn btn-secondary">
                          <Download size={14} /> Télécharger
                        </a>
                      )}
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
