'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Send, Bot, Sparkles } from 'lucide-react'

interface Message { id: string; role: string; content: string; sent_at: string }
interface Conv { id: string; guest_name?: string; guest_phone: string; apartment_name?: string; status: string }

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function ConversationPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [conv, setConv] = useState<Conv | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [useAI, setUseAI] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/agent/conversations/${id}`)
      .then(r => r.json())
      .then(d => {
        setConv(d.conversation)
        setMessages(d.messages ?? [])
        setLoading(false)
      })
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    if (!input.trim() || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)
    try {
      const res = await fetch(`/api/agent/conversations/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, use_ai: useAI }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessages(prev => [
          ...prev,
          { id: Date.now().toString(), role: 'user', content: text, sent_at: new Date().toISOString() },
          { id: (Date.now() + 1).toString(), role: 'assistant', content: data.content, sent_at: new Date().toISOString() },
        ])
      }
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="page-body" style={{ paddingTop: 40 }}>
        <div className="empty-state"><Bot size={32} /><h3>Chargement…</h3></div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      {/* Header */}
      <div className="page-header" style={{ flexShrink: 0, paddingBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" style={{ padding: '6px 0' }} onClick={() => router.push('/messages')}>
            <ArrowLeft size={16} />
          </button>
          <div style={{
            width: 40, height: 40, borderRadius: 999, flexShrink: 0,
            background: 'linear-gradient(135deg, var(--slate-600), var(--blue))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, color: '#fff', fontSize: 16,
          }}>
            {(conv?.guest_name ?? '?')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--slate)' }}>
              {conv?.guest_name ?? conv?.guest_phone}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              {conv?.apartment_name ?? ''} · {conv?.guest_phone}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '12px 20px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {messages.map(m => (
          <div key={m.id} style={{
            display: 'flex',
            flexDirection: m.role === 'assistant' ? 'row' : 'row-reverse',
            gap: 8, alignItems: 'flex-end',
          }}>
            {m.role === 'assistant' && (
              <div style={{
                width: 28, height: 28, borderRadius: 999, flexShrink: 0,
                background: 'var(--blue)', display: 'flex', alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Bot size={14} style={{ color: '#fff' }} />
              </div>
            )}
            <div style={{
              maxWidth: '72%',
              background: m.role === 'assistant' ? 'var(--surface)' : 'var(--blue)',
              color: m.role === 'assistant' ? 'var(--slate)' : '#fff',
              borderRadius: m.role === 'assistant' ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
              padding: '10px 14px',
              fontSize: 13.5,
              lineHeight: 1.55,
              border: m.role === 'assistant' ? '1px solid var(--line)' : 'none',
              boxShadow: '0 1px 3px rgba(0,0,0,.06)',
              whiteSpace: 'pre-wrap',
            }}>
              {m.content}
              <div style={{
                fontSize: 10.5, marginTop: 4,
                color: m.role === 'assistant' ? 'var(--ink-3)' : 'rgba(255,255,255,.6)',
              }}>
                {fmtTime(m.sent_at)}
              </div>
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{
              width: 28, height: 28, borderRadius: 999, flexShrink: 0,
              background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bot size={14} style={{ color: '#fff' }} />
            </div>
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: '4px 16px 16px 16px', padding: '10px 16px',
              display: 'flex', gap: 5, alignItems: 'center',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--ink-3)', animation: 'blink .9s .0s infinite' }}></span>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--ink-3)', animation: 'blink .9s .2s infinite' }}></span>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--ink-3)', animation: 'blink .9s .4s infinite' }}></span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{
        borderTop: '1px solid var(--line)', padding: '12px 16px',
        background: 'var(--surface)', flexShrink: 0,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {/* AI toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            className={`switch${useAI ? ' on' : ''}`}
            onClick={() => setUseAI(p => !p)}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ fontSize: 12.5, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Sparkles size={12} /> Réponse IA automatique
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            className="form-input"
            rows={2}
            style={{ flex: 1, resize: 'none', fontSize: 13.5 }}
            placeholder={useAI ? 'Décrivez ce que vous voulez répondre, l\'IA rédige...' : 'Écrivez votre message...'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          />
          <button
            className="btn btn-primary"
            style={{ padding: '10px 14px', flexShrink: 0 }}
            onClick={send}
            disabled={!input.trim() || sending}
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes blink {
          0%, 80%, 100% { opacity: .2 }
          40% { opacity: 1 }
        }
      `}</style>
    </div>
  )
}
