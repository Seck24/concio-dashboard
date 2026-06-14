'use client'

import { useEffect, useState } from 'react'
import { MessageSquare, Bot, User } from 'lucide-react'

interface Thread {
  reservation_id: string
  guest_name?: string
  apartment_name: string
  last_message?: string
  last_sent?: string
  last_direction?: string
  is_bot?: boolean
  unread_count: number
  checkin: string
  checkout: string
}

function fmtTime(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function MessagesPage() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/messages')
      .then(r => r.json())
      .then(d => { setThreads(Array.isArray(d) ? d : []); setLoading(false) })
  }, [])

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Messages</h1>
          <div className="sub">Conversations voyageurs via WhatsApp & plateformes</div>
        </div>
      </div>
      <div className="mobile-topbar">
        <div><h1>Messages</h1></div>
      </div>

      <div className="page-body">
        {loading ? (
          <div className="empty-state"><MessageSquare size={32} /><h3>Chargement…</h3></div>
        ) : threads.length === 0 ? (
          <div className="empty-state">
            <MessageSquare size={42} />
            <h3>Aucun message</h3>
            <p>Les conversations avec vos voyageurs apparaissent ici une fois les réservations synchronisées.</p>
          </div>
        ) : (
          <div className="panel">
            <div className="panel-b" style={{ padding: 0 }}>
              {threads.map(t => (
                <div key={t.reservation_id} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                  borderBottom: '1px solid var(--line-2)', cursor: 'pointer',
                  background: t.unread_count > 0 ? 'var(--blue-50)' : 'transparent',
                  transition: 'background .15s',
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: 42, height: 42, borderRadius: 999, flexShrink: 0,
                    background: 'linear-gradient(135deg, var(--slate-600), var(--blue))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, color: '#fff', fontSize: 16,
                  }}>
                    {(t.guest_name ?? '?')[0].toUpperCase()}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--slate)' }}>
                        {t.guest_name ?? 'Voyageur'}
                      </span>
                      <span style={{ fontSize: 11.5, color: 'var(--ink-3)', flexShrink: 0 }}>
                        {fmtTime(t.last_sent)}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 1 }}>{t.apartment_name}</div>
                    <div style={{
                      fontSize: 12.5, color: t.unread_count > 0 ? 'var(--slate)' : 'var(--ink-3)',
                      fontWeight: t.unread_count > 0 ? 600 : 400,
                      marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {t.last_direction === 'outbound' && (
                        <span style={{ marginRight: 4 }}>
                          {t.is_bot ? <Bot size={11} style={{ display: 'inline', marginRight: 3 }} /> : ''}
                        </span>
                      )}
                      {t.last_message ?? 'Aucun message'}
                    </div>
                  </div>

                  {t.unread_count > 0 && (
                    <span style={{
                      width: 20, height: 20, borderRadius: 999, background: 'var(--blue)',
                      color: '#fff', fontSize: 11, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>{t.unread_count}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
