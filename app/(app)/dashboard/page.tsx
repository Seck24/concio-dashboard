'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Clock, MessageCircle, LogIn, LogOut, Sparkles, User } from 'lucide-react'

interface Stats { arrivals: number; departures: number; cleanings_in_progress: number; open_alerts: number }
interface Alert { id: string; type: string; message: string; apartment_name?: string; created_at: string }
interface TimelineItem {
  apartment_name: string
  today_event: 'arrivee' | 'depart' | 'occupe'
  guest_name?: string
  checkin?: string
  checkout?: string
  cleaning_start?: string
  cleaning_status?: string
  cleaner_name?: string
}

const ALERT_LABELS: Record<string, { icon: typeof AlertTriangle; label: string; color: 'danger' | 'warning' | 'info' }> = {
  early_checkin:   { icon: Clock,           label: 'Early check-in demandé',    color: 'warning' },
  late_checkout:   { icon: Clock,           label: 'Late check-out demandé',     color: 'warning' },
  cleaning_short:  { icon: AlertTriangle,   label: 'Durée de ménage anormale',   color: 'danger'  },
  unusual_message: { icon: MessageCircle,   label: 'Message hors-script',        color: 'warning' },
  low_stock:       { icon: AlertTriangle,   label: 'Stock bas',                  color: 'info'    },
}

function timeStr(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tenantName, setTenantName] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard').then(r => r.json()),
      fetch('/api/auth/me').then(r => r.json()),
    ]).then(([dash, me]) => {
      setStats(dash.stats)
      setAlerts(dash.alerts ?? [])
      setTimeline(dash.overview ?? [])
      setTenantName(me.name ?? '')
      setLoading(false)
    })
  }, [])

  async function resolveAlert(id: string, status: 'resolved' | 'dismissed') {
    await fetch(`/api/alerts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const firstName = tenantName.split(' ')[0]

  return (
    <>
      {/* Mobile topbar */}
      <div className="mobile-topbar">
        <div>
          <h1>Bonjour {firstName} 👋</h1>
          <div className="sub">{today}</div>
        </div>
        {alerts.length > 0 && (
          <div className="notif-btn">
            <AlertTriangle size={18} />
            <span className="notif-dot"></span>
          </div>
        )}
      </div>

      {/* Desktop header */}
      <div className="page-header">
        <div>
          <h1>Bonjour, {firstName} 👋</h1>
          <div className="sub">{today}</div>
        </div>
      </div>

      <div className="page-body">
        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-icon blue"><LogIn size={17} /></div>
            <div className="stat-num">{loading ? '–' : (stats?.arrivals ?? 0)}</div>
            <div className="stat-label">Arrivées aujourd'hui</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon gray"><LogOut size={17} /></div>
            <div className="stat-num">{loading ? '–' : (stats?.departures ?? 0)}</div>
            <div className="stat-label">Départs aujourd'hui</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><Sparkles size={17} /></div>
            <div className="stat-num">{loading ? '–' : (stats?.cleanings_in_progress ?? 0)}</div>
            <div className="stat-label">Ménages en cours</div>
          </div>
          <div className={`stat-card${(stats?.open_alerts ?? 0) > 0 ? ' alert-on' : ''}`}>
            <div className="stat-icon red"><AlertTriangle size={17} /></div>
            <div className="stat-num">{loading ? '–' : (stats?.open_alerts ?? 0)}</div>
            <div className="stat-label">Alertes ouvertes</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 20 }}>
          {/* Left col */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Alerts */}
            {alerts.length > 0 && (
              <div className="panel">
                <div className="panel-h">
                  <h3>À gérer maintenant</h3>
                  <span className="badge badge-red"><span className="pip"></span>{alerts.length}</span>
                </div>
                <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {alerts.map(a => {
                    const meta = ALERT_LABELS[a.type] ?? { icon: AlertTriangle, label: a.type, color: 'info' as const }
                    const Icon = meta.icon
                    return (
                      <div key={a.id} className={`alert-card ${meta.color}`}>
                        <div className="alert-head">
                          <div className="alert-ic"><Icon size={16} /></div>
                          <div className="alert-body">
                            <div className="alert-title">{meta.label}{a.apartment_name ? ` — ${a.apartment_name}` : ''}</div>
                            <div className="alert-meta">{a.message}</div>
                          </div>
                        </div>
                        <div className="alert-actions">
                          <button className="btn btn-secondary btn-sm" onClick={() => resolveAlert(a.id, 'dismissed')}>
                            Ignorer
                          </button>
                          <button className="btn btn-primary btn-sm" onClick={() => resolveAlert(a.id, 'resolved')}>
                            Résolu
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="panel">
              <div className="panel-h">
                <h3>Agenda du jour</h3>
                <a className="link" href="/apartments">Tout voir</a>
              </div>
              <div className="panel-b">
                {timeline.length === 0 && !loading ? (
                  <div className="empty-state">
                    <Sparkles size={32} />
                    <h3>Rien à signaler</h3>
                    <p>Aucun événement aujourd'hui.</p>
                  </div>
                ) : (
                  <div className="timeline">
                    {timeline.map((item, i) => {
                      const isArr = item.today_event === 'arrivee'
                      const isDep = item.today_event === 'depart'
                      const isClean = item.cleaning_status === 'in_progress'
                      const dotColor = isClean ? 'green' : isArr ? 'blue' : 'gray'
                      const time = isArr ? timeStr(item.checkin) : isDep ? timeStr(item.checkout) : timeStr(item.cleaning_start)
                      const isLast = i === timeline.length - 1
                      return (
                        <div key={i} className="tl-item">
                          <div className="tl-rail">
                            <span className="tl-time">{time}</span>
                            <span className={`tl-dot ${dotColor}`}></span>
                            {!isLast && <span className="tl-line"></span>}
                          </div>
                          <div className="tl-card" style={isLast ? { marginBottom: 0 } : {}}>
                            <div className="tc-top">
                              <span className="tc-name">{item.apartment_name}</span>
                              {isArr && <span className="badge badge-blue">Arrivée</span>}
                              {isDep && <span className="badge badge-slate">Départ</span>}
                              {item.cleaning_status === 'in_progress' && <span className="badge badge-green">Ménage en cours</span>}
                              {item.cleaning_status === 'planned' && <span className="badge badge-gray">Ménage prévu</span>}
                            </div>
                            <div className="tc-sub">
                              <User size={12} />
                              {item.guest_name ?? item.cleaner_name ?? '–'}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right col — desktop only */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="panel">
              <div className="panel-h"><h3>Occupation — 7 jours</h3></div>
              <div className="panel-b">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-3)', marginBottom: 8 }}>
                  {['L','M','M','J','V','S','D'].map((d,i) => <span key={i}>{d}</span>)}
                </div>
                <div className="heat-row">
                  {[3,2,2,3,4,4,3].map((h, i) => (
                    <div key={i} className={`heat-cell heat-${h}`}>{[9,7,6,10,12,12,11][i]}</div>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 11.5, color: 'var(--ink-3)' }}>
                  <span>Vide</span>
                  <span style={{ flex: 1, height: 8, borderRadius: 999, background: 'linear-gradient(90deg,#F1F4F8,#DBEAFE,#93C5FD,#3B82F6,#1E2D40)' }}></span>
                  <span>Plein</span>
                </div>
              </div>
            </div>

            {alerts.length === 0 && (
              <div className="panel">
                <div className="panel-h"><h3>Tout est en ordre ✅</h3></div>
                <div className="panel-b">
                  <p style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>Aucune alerte en attente. Votre conciergerie tourne en pilote automatique.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          [style*="grid-template-columns"] { display: block !important; }
          [style*="grid-template-columns"] > div + div { margin-top: 16px; }
        }
      `}</style>
    </>
  )
}
