'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bot, MessageCircle, ChevronRight } from 'lucide-react'

interface Conv {
  id: string
  guest_name?: string
  guest_phone: string
  status: string
  apartment_name?: string
  updated_at: string
  last_message?: string
  last_role?: string
  message_count: number
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function MessagesPage() {
  const router = useRouter()
  const [convs, setConvs] = useState<Conv[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/agent/conversations')
      .then(r => r.json())
      .then(d => { setConvs(Array.isArray(d) ? d : []); setLoading(false) })
  }, [])

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Messages</h1>
          <div className="sub">Conversations voyageurs gérées par l'agent IA</div>
        </div>
      </div>
      <div className="mobile-topbar">
        <div><h1>Messages</h1></div>
      </div>

      <div className="page-body">
        {loading ? (
          <div className="empty-state"><Bot size={32} /><h3>Chargement…</h3></div>
        ) : convs.length === 0 ? (
          <div className="empty-state">
            <MessageCircle size={42} />
            <h3>Aucune conversation</h3>
            <p>Ouvrez une réservation, ajoutez le numéro du voyageur et démarrez la conversation via l'agent IA.</p>
          </div>
        ) : (
          <div className="panel">
            <div className="panel-b" style={{ padding: 0 }}>
              {convs.map(c => (
                <div
                  key={c.id}
                  onClick={() => router.push(`/messages/${c.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 18px', borderBottom: '1px solid var(--line-2)',
                    cursor: 'pointer', transition: 'background .15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 999, flexShrink: 0,
                    background: 'linear-gradient(135deg, var(--slate-600), var(--blue))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, color: '#fff', fontSize: 17,
                  }}>
                    {(c.guest_name ?? '?')[0].toUpperCase()}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--slate)' }}>
                        {c.guest_name ?? c.guest_phone}
                      </span>
                      <span style={{ fontSize: 11.5, color: 'var(--ink-3)', flexShrink: 0 }}>
                        {fmtTime(c.updated_at)}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 1 }}>
                      {c.apartment_name ?? ''} · {c.message_count} msg
                    </div>
                    {c.last_message && (
                      <div style={{
                        fontSize: 13, color: 'var(--ink-2)', marginTop: 4,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {c.last_role === 'assistant' ? '🤖 ' : '👤 '}
                        {c.last_message}
                      </div>
                    )}
                  </div>

                  <ChevronRight size={16} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
