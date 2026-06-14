'use client'

import { useEffect, useState } from 'react'
import { Sparkles, CheckCircle, AlertTriangle, Clock } from 'lucide-react'

interface Session {
  id: string
  apartment_name: string
  cleaner_name?: string
  planned_start: string
  planned_duration_min?: number
  actual_duration_min?: number
  actual_start?: string
  actual_end?: string
  status: 'planned' | 'in_progress' | 'completed' | 'alert' | 'cancelled'
}

function fmtDur(min?: number | null) {
  if (!min) return '–'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h${m > 0 ? m.toString().padStart(2,'0') : ''}` : `${m}min`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}
function fmtTime(iso?: string) {
  if (!iso) return '–'
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function MenagesPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'alert' | 'in_progress' | 'completed'>('all')

  useEffect(() => {
    fetch('/api/cleaning')
      .then(r => r.json())
      .then(d => { setSessions(Array.isArray(d) ? d : []); setLoading(false) })
  }, [])

  const filtered = sessions.filter(s => {
    if (filter === 'alert') return s.status === 'alert' || (s.actual_duration_min && s.planned_duration_min && s.actual_duration_min < s.planned_duration_min * 0.6)
    if (filter === 'in_progress') return s.status === 'in_progress'
    if (filter === 'completed') return s.status === 'completed'
    return true
  })

  const alerts = sessions.filter(s => s.status === 'alert' || (s.actual_duration_min && s.planned_duration_min && s.actual_duration_min < s.planned_duration_min * 0.6)).length

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Ménages</h1>
          <div className="sub">7 derniers jours{alerts > 0 ? ` · ${alerts} alerte${alerts > 1 ? 's' : ''}` : ''}</div>
        </div>
      </div>
      <div className="mobile-topbar">
        <div><h1>Ménages</h1><div className="sub">{sessions.length} sessions</div></div>
      </div>

      <div className="page-body">
        <div className="chips">
          {[
            { key: 'all',         label: 'Tous' },
            { key: 'in_progress', label: 'En cours' },
            { key: 'completed',   label: 'Terminés' },
            { key: 'alert',       label: `⚠️ Alertes${alerts > 0 ? ` (${alerts})` : ''}` },
          ].map(f => (
            <button key={f.key} className={`chip${filter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key as typeof filter)}>
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="empty-state"><Sparkles size={32} /><h3>Chargement…</h3></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><Sparkles size={32} /><h3>Aucun ménage</h3><p>Les sessions apparaissent ici après les pointages QR.</p></div>
        ) : (
          <div className="panel">
            <div className="panel-b" style={{ padding: 0 }}>
              {filtered.map(s => {
                const isShort = s.actual_duration_min != null && s.planned_duration_min != null && s.actual_duration_min < s.planned_duration_min * 0.6
                return (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 18px', borderBottom: '1px solid var(--line-2)',
                  }}>
                    {/* Status icon */}
                    <div style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      background: s.status === 'completed' ? 'var(--emerald-50)' : s.status === 'in_progress' ? 'var(--blue-50)' : isShort ? 'var(--coral-50)' : 'var(--line-2)',
                    }}>
                      {s.status === 'completed' && !isShort && <CheckCircle size={18} color="var(--emerald)" />}
                      {isShort && <AlertTriangle size={18} color="var(--coral)" />}
                      {s.status === 'in_progress' && <Clock size={18} color="var(--blue)" />}
                      {s.status === 'planned' && <Sparkles size={18} color="var(--ink-3)" />}
                      {s.status === 'alert' && <AlertTriangle size={18} color="var(--coral)" />}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--slate)' }}>{s.apartment_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
                        {fmtDate(s.planned_start)}
                        {s.cleaner_name ? ` · ${s.cleaner_name}` : ''}
                        {s.actual_start ? ` · Entrée ${fmtTime(s.actual_start)}` : ''}
                        {s.actual_end ? ` · Sortie ${fmtTime(s.actual_end)}` : ''}
                      </div>
                    </div>

                    {/* Duration */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: isShort ? 'var(--coral)' : s.actual_duration_min ? 'var(--emerald)' : 'var(--ink-3)' }}>
                        {fmtDur(s.actual_duration_min)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                        / {fmtDur(s.planned_duration_min)} prévu
                      </div>
                    </div>

                    {/* Badge */}
                    <span className={`badge ${
                      isShort ? 'badge-red'
                      : s.status === 'completed' ? 'badge-green'
                      : s.status === 'in_progress' ? 'badge-blue'
                      : 'badge-gray'
                    }`} style={{ flexShrink: 0 }}>
                      {isShort ? '⚠️ Court' : s.status === 'completed' ? 'Terminé' : s.status === 'in_progress' ? 'En cours' : 'Prévu'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
